from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user, require_pin
from app.config import get_settings, loop_callback_url
from app.db import get_db
from app.loop.completion import (
    complete_pending_transaction,
    is_success,
    record_completed_payment,
    record_completed_send_money,
    track_pending_topup,
)
from app.loop import (
    LOOP_PROMPT,
    MPESA_PROMPT,
    PAY_TO_LOOP_TILL,
    PAY_TO_MPESA_TILL,
    PAY_TO_PAYBILL,
    SEND_MONEY_LOOP,
    SEND_MONEY_MPESA,
    SEND_MONEY_PESALINK,
    TRANSACTION_HISTORY,
    TRANSACTION_INQUIRY,
    get_gateway,
)
from app.loop.products import (
    catalog_items,
    ensure_history,
    fields_for,
    find_product,
    simulate_product,
)
from app.schemas import (
    LoopPromptRequest,
    MpesaPromptRequest,
    PayToTillRequest,
    SendMoneyRequest,
    TransactionHistoryRequest,
    TransactionInquiryRequest,
)

router = APIRouter(prefix="/api/loop")


def _envelope(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": result.get("statusCode"),
        "message": result.get("message"),
        "data": result.get("data"),
        "txnReference": result.get("txnReference"),
    }


def _amount(value: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


@router.get("/status")
def status():
    settings = get_settings()
    configured = bool(settings.loop_consumer_key.strip() and settings.loop_consumer_secret.strip())
    till_ready = bool(settings.loop_default_till.strip() and settings.loop_default_till_secret.strip())
    return {
        "success": True,
        "data": {
            "configured": configured,
            "tillReady": till_ready,
            "gateway": settings.loop_gateway_base_url,
            "tokenUrl": f"{settings.loop_base_url.rstrip('/')}/oauth2/token",
            "merchantTill": settings.loop_default_till,
            "callbackBaseUrl": loop_callback_url("").rstrip("/"),
            "docs": "https://sandbox.loop.co.ke/devportal/docs/loop-api/introduction",
            "myApps": "https://sandbox.loop.co.ke/devportal/my-apps",
            "products": catalog_items(),
            "note": (
                (
                    "Consumer credentials + till secret loaded. Live STK/prompts can be signed."
                    if till_ready
                    else "OAuth keys loaded, but till secret is missing. Live STK needs LOOP_DEFAULT_TILL + LOOP_DEFAULT_TILL_SECRET from My Apps (must match the same till)."
                )
                if configured
                else "Add LOOP_CONSUMER_KEY and LOOP_CONSUMER_SECRET to backend/.env, then restart the API."
            ),
        },
    }


@router.get("/products")
def products():
    return {"success": True, "data": catalog_items()}


@router.get("/products/{product_id}")
def product(product_id: str):
    item = find_product(product_id)
    if item is None:
        return JSONResponse(status_code=404, content={"success": False, "message": "Product not found"})
    pid, name, status_val, description = item
    if "prompt" in pid:
        simulate_label = "Simulate another prompt"
    elif pid == "authorisation":
        simulate_label = "Simulate authorisation"
    else:
        simulate_label = "Simulate another transaction"
    return {
        "success": True,
        "data": {
            "id": pid,
            "name": name,
            "status": status_val,
            "description": description,
            "fields": fields_for(pid),
            "history": ensure_history(pid),
            "simulateLabel": simulate_label,
        },
    }


@router.get("/products/{product_id}/history")
def product_history(product_id: str):
    if find_product(product_id) is None:
        return JSONResponse(status_code=404, content={"success": False, "message": "Product not found"})
    return {"success": True, "data": ensure_history(product_id)}


# Live runs of these products move real money, so they need the same PIN check
# as the dedicated send-money endpoints.
PIN_PROTECTED_PRODUCTS = {"send-money-mpesa", "send-money-pesalink"}

# Products whose live run should leave a ledger entry, and how to post it.
_TOPUP_PRODUCTS = {"loop-prompt", "mpesa-prompt"}
_PAYMENT_PRODUCTS = {"pay-to-loop-till", "pay-to-mpesa-till", "pay-to-paybill"}
_SEND_PRODUCTS = {"send-money-loop", "send-money-mpesa", "send-money-pesalink"}


@router.post("/products/{product_id}/simulate")
def simulate(
    product_id: str,
    body: dict[str, Any] | None = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if find_product(product_id) is None:
        return JSONResponse(status_code=404, content={"success": False, "message": "Product not found"})

    payload = dict(body or {})
    live = payload.get("live") is True or payload.get("live") == "true"

    # Ledger/authentication fields are ours, not LOOP's — strip them before the call.
    pin = payload.pop("pin", None)
    entity_id = payload.pop("entityId", None)
    account_id = payload.pop("accountId", None)

    if live and product_id in PIN_PROTECTED_PRODUCTS:
        require_pin(user, str(pin) if pin is not None else None)

    outcome = simulate_product(product_id, payload)

    # Record both live and simulated runs. Simulated ones are marked `demo`
    # provenance so the ledger shows the flow without claiming money moved.
    if outcome.get("success") and entity_id and account_id:
        _post_simulated_to_ledger(
            db,
            product_id,
            payload,
            outcome,
            entity_id,
            account_id,
            provenance="actual" if outcome.get("mode") == "live" else "demo",
        )

    return outcome


PRODUCT_LABELS = {
    "loop-prompt": "LOOP prompt",
    "mpesa-prompt": "M-Pesa STK prompt",
    "pay-to-loop-till": "Pay to LOOP till",
    "pay-to-mpesa-till": "Pay to M-Pesa till",
    "pay-to-paybill": "Pay to paybill",
    "send-money-loop": "Send money — LOOP",
    "send-money-mpesa": "Send money — M-Pesa",
    "send-money-pesalink": "Send money — Pesalink",
}


def _post_simulated_to_ledger(
    db: Session,
    product_id: str,
    payload: dict[str, Any],
    outcome: dict[str, Any],
    entity_id: str,
    account_id: str,
    provenance: str = "actual",
) -> None:
    """Mirror a payments-console run into the ledger."""
    result = outcome.get("result")
    if not isinstance(result, dict):
        return
    txn_reference = result.get("txnReference")
    if not txn_reference:
        return
    amount = _amount(str(payload.get("amount", "0")))
    if amount <= 0:
        return

    label = PRODUCT_LABELS.get(product_id, product_id)
    suffix = " (simulated)" if provenance == "demo" else ""

    if product_id in _TOPUP_PRODUCTS:
        counterparty = payload.get("payMblNo") or payload.get("mobileNo") or ""
        track_pending_topup(
            db,
            entity_id=entity_id,
            account_id=account_id,
            amount=amount,
            txn_reference=txn_reference,
            description=f"{label} from {counterparty}{suffix}".strip(),
            provenance=provenance,
        )
        # A simulated prompt has no callback coming, so settle it right away.
        if provenance == "demo":
            complete_pending_transaction(db, txn_reference=txn_reference, success=True)
    elif product_id in _PAYMENT_PRODUCTS:
        record_completed_payment(
            db,
            entity_id=entity_id,
            account_id=account_id,
            amount=amount,
            txn_reference=txn_reference,
            description=f"{label} {payload.get('merchantRcvTill', '')}{suffix}".strip(),
            category="Bill payment",
            provenance=provenance,
        )
    elif product_id in _SEND_PRODUCTS:
        record_completed_send_money(
            db,
            entity_id=entity_id,
            account_id=account_id,
            amount=amount,
            txn_reference=txn_reference,
            description=f"{label} to {payload.get('recipientMobileNo', '')}{suffix}".strip(),
            provenance=provenance,
        )

@router.post("/loop-prompt")
def loop_prompt(
    req: LoopPromptRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    callback_url = req.callback_url or loop_callback_url("loop-prompt")
    if not callback_url.lower().startswith("https://"):
        callback_url = loop_callback_url("loop-prompt")
    result = get_gateway().send(
        LOOP_PROMPT,
        {
            "mobileNo": req.mobile_no,
            "amount": req.amount,
            "reason": req.reason,
            "callBackUrl": callback_url,
        },
        req.till,
    )
    if is_success(result) and req.entity_id and req.account_id:
        track_pending_topup(
            db,
            entity_id=req.entity_id,
            account_id=req.account_id,
            amount=_amount(req.amount),
            txn_reference=result["txnReference"],
            description=f"LOOP prompt — {req.reason}",
        )
    return _envelope(result)


@router.post("/mpesa-prompt")
def mpesa_prompt(
    req: MpesaPromptRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    callback_url = req.callback_url or loop_callback_url("mpesa-prompt")
    if not callback_url.lower().startswith("https://"):
        callback_url = loop_callback_url("mpesa-prompt")
    result = get_gateway().send(
        MPESA_PROMPT,
        {
            "payMblNo": req.pay_mbl_no,
            "amount": req.amount,
            "extRefNo": req.ext_ref_no,
            "callBackUrl": callback_url,
        },
        req.till,
    )
    if is_success(result) and req.entity_id and req.account_id:
        track_pending_topup(
            db,
            entity_id=req.entity_id,
            account_id=req.account_id,
            amount=_amount(req.amount),
            txn_reference=result["txnReference"],
            description=f"M-Pesa STK top-up — {req.ext_ref_no}",
        )
    return _envelope(result)


@router.post("/transactions/inquiry")
def transaction_inquiry(req: TransactionInquiryRequest, db: Session = Depends(get_db)):
    result = get_gateway().send(TRANSACTION_INQUIRY, {"txnReference": req.txn_reference}, req.till)
    if result.get("statusCode") is not None:
        complete_pending_transaction(
            db, txn_reference=req.txn_reference, success=is_success(result)
        )
    return _envelope(result)


@router.post("/transactions/history")
def transaction_history(req: TransactionHistoryRequest):
    result = get_gateway().send(TRANSACTION_HISTORY, {"limit": req.limit}, req.till)
    return _envelope(result)


def _apply_pay(db: Session, req: PayToTillRequest, result: dict[str, Any], description: str) -> None:
    if is_success(result) and req.entity_id and req.account_id:
        record_completed_payment(
            db,
            entity_id=req.entity_id,
            account_id=req.account_id,
            amount=_amount(req.amount),
            txn_reference=result["txnReference"],
            description=description,
            category="Bill payment",
            liability_id=req.liability_id,
            obligation_id=req.obligation_id,
        )


@router.post("/pay/loop-till")
def pay_loop_till(
    req: PayToTillRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = get_gateway().send(
        PAY_TO_LOOP_TILL,
        {"merchantRcvTill": req.merchant_rcv_till, "accountNumber": req.account_number, "amount": req.amount},
        req.till,
    )
    _apply_pay(db, req, result, f"LOOP till {req.merchant_rcv_till}")
    return _envelope(result)


@router.post("/pay/mpesa-till")
def pay_mpesa_till(
    req: PayToTillRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = get_gateway().send(
        PAY_TO_MPESA_TILL,
        {"merchantRcvTill": req.merchant_rcv_till, "accountNumber": req.account_number, "amount": req.amount},
        req.till,
    )
    _apply_pay(db, req, result, f"M-Pesa till {req.merchant_rcv_till}")
    return _envelope(result)


@router.post("/pay/paybill")
def pay_paybill(
    req: PayToTillRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = get_gateway().send(
        PAY_TO_PAYBILL,
        {"merchantRcvTill": req.merchant_rcv_till, "accountNumber": req.account_number, "amount": req.amount},
        req.till,
    )
    _apply_pay(db, req, result, f"Paybill {req.merchant_rcv_till}")
    return _envelope(result)


def _apply_send(db: Session, req: SendMoneyRequest, result: dict[str, Any]) -> None:
    if is_success(result) and req.entity_id and req.account_id:
        record_completed_send_money(
            db,
            entity_id=req.entity_id,
            account_id=req.account_id,
            amount=_amount(req.amount),
            txn_reference=result["txnReference"],
            description=f"Send money to {req.recipient_mobile_no} — {req.purpose_of_payment}",
            goal_id=req.goal_id,
            automation_rule_id=req.automation_rule_id,
        )


@router.post("/send-money/loop")
def send_money_loop(
    req: SendMoneyRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = get_gateway().send(
        SEND_MONEY_LOOP,
        {
            "recipientMobileNo": req.recipient_mobile_no,
            "amount": req.amount,
            "purposeOfPayment": req.purpose_of_payment,
        },
        req.till,
    )
    _apply_send(db, req, result)
    return _envelope(result)


@router.post("/send-money/mpesa")
def send_money_mpesa(
    req: SendMoneyRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_pin(user, req.pin)
    result = get_gateway().send(
        SEND_MONEY_MPESA,
        {
            "recipientMobileNo": req.recipient_mobile_no,
            "amount": req.amount,
            "purposeOfPayment": req.purpose_of_payment,
        },
        req.till,
    )
    _apply_send(db, req, result)
    return _envelope(result)


@router.post("/send-money/pesalink")
def send_money_pesalink(
    req: SendMoneyRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_pin(user, req.pin)
    result = get_gateway().send(
        SEND_MONEY_PESALINK,
        {
            "recipientMobileNo": req.recipient_mobile_no,
            "amount": req.amount,
            "purposeOfPayment": req.purpose_of_payment,
        },
        req.till,
    )
    _apply_send(db, req, result)
    return _envelope(result)
