from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import get_settings, loop_callback_url
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

CATALOG: list[tuple[str, str, str, str]] = [
    ("authorisation", "Authorisation", "published", "OAuth 2.0 client credentials → Bearer access token"),
    ("loop-prompt", "LOOP Prompt", "prototyped", "Request-to-pay prompt on the LOOP mobile app"),
    ("transaction-inquiry", "Merchant Transaction Inquiry", "published", "Poll status of a prior merchant transaction"),
    ("transaction-history", "MerchantTransactionHistory", "published", "Recent transactions on the LOOP BIZ till"),
    ("mpesa-prompt", "Mpesa Prompt", "published", "STK-style payment prompt into your LOOP till"),
    ("pay-to-loop-till", "Pay to LOOP till", "published", "Pay from your till to another LOOP merchant till"),
    ("pay-to-mpesa-till", "Pay to M-Pesa Till", "published", "Pay from LOOP BIZ to an M-Pesa buy-goods till"),
    ("pay-to-paybill", "Pay To Paybill", "published", "Pay from LOOP BIZ to an M-Pesa paybill"),
    ("send-money-loop", "Send Money - Loop", "unavailable", "LOOP sandbox returns auth error on this product right now — use Send Money - M-Pesa instead"),
    ("send-money-mpesa", "Send Money - M-Pesa", "published", "Payout from LOOP BIZ to M-Pesa"),
    ("send-money-pesalink", "Send Money Pesalink", "published", "Payout from LOOP BIZ via PesaLink to a bank-linked mobile"),
]

_history: dict[str, list[dict[str, Any]]] = {}


def catalog_items() -> list[dict[str, str]]:
    return [{"id": i, "name": n, "status": s, "description": d} for i, n, s, d in CATALOG]


def find_product(product_id: str) -> tuple[str, str, str, str] | None:
    for item in CATALOG:
        if item[0] == product_id:
            return item
    return None


def fields_for(product_id: str) -> list[dict[str, str]]:
    if product_id == "loop-prompt":
        return [
            {"key": "mobileNo", "label": "Customer mobile", "defaultValue": "254704540384"},
            {"key": "amount", "label": "Amount (KES)", "defaultValue": "100"},
            {"key": "reason", "label": "Reason", "defaultValue": "Wealth Loop simulated prompt"},
        ]
    if product_id == "mpesa-prompt":
        return [
            {"key": "payMblNo", "label": "Customer mobile", "defaultValue": "0704540384"},
            {"key": "amount", "label": "Amount (KES)", "defaultValue": "50"},
            {"key": "extRefNo", "label": "External reference", "defaultValue": f"WL-{uuid.uuid4().hex[:10].upper()}"},
        ]
    if product_id == "transaction-inquiry":
        return [{"key": "txnReference", "label": "Original txnReference", "defaultValue": str(uuid.uuid4())}]
    if product_id == "transaction-history":
        return [{"key": "limit", "label": "Limit", "defaultValue": "5"}]
    if product_id in ("pay-to-loop-till", "pay-to-mpesa-till", "pay-to-paybill"):
        return [
            {
                "key": "merchantRcvTill",
                "label": "Paybill number" if product_id == "pay-to-paybill" else "Receiver till",
                "defaultValue": "888880" if product_id == "pay-to-paybill" else "133238",
            },
            {"key": "accountNumber", "label": "Account / reference", "defaultValue": "INV-1001"},
            {"key": "amount", "label": "Amount (KES)", "defaultValue": "100"},
        ]
    if product_id in ("send-money-loop", "send-money-mpesa", "send-money-pesalink"):
        return [
            {"key": "recipientMobileNo", "label": "Recipient mobile", "defaultValue": "254705568254"},
            {"key": "amount", "label": "Amount (KES)", "defaultValue": "200"},
            {"key": "purposeOfPayment", "label": "Purpose", "defaultValue": "Wealth Loop simulation"},
        ]
    return []


def ensure_history(product_id: str) -> list[dict[str, Any]]:
    if product_id not in _history:
        _history[product_id] = [
            {
                "id": str(uuid.uuid4()),
                "productId": product_id,
                "at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat().replace("+00:00", "Z"),
                "mode": "simulated",
                "summary": f"Seed history for {product_id}",
                "success": True,
            }
        ]
    return _history[product_id]


def _pay_params(body: dict[str, Any]) -> dict[str, Any]:
    return {
        "merchantRcvTill": str(body.get("merchantRcvTill")) if body.get("merchantRcvTill") is not None else None,
        "accountNumber": str(body.get("accountNumber")) if body.get("accountNumber") is not None else None,
        "amount": str(body.get("amount")) if body.get("amount") is not None else None,
    }


def _send_params(body: dict[str, Any]) -> dict[str, Any]:
    return {
        "recipientMobileNo": str(body.get("recipientMobileNo")) if body.get("recipientMobileNo") is not None else None,
        "amount": str(body.get("amount")) if body.get("amount") is not None else None,
        "purposeOfPayment": str(body.get("purposeOfPayment") or "Transfer"),
    }


def simulate_product(product_id: str, body: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    live = body.pop("live", False)
    live = live is True or live == "true"
    configured = bool(settings.loop_consumer_key.strip() and settings.loop_consumer_secret.strip())
    want_live = live and configured
    mode = "live" if want_live else "simulated"
    success = True
    error = None
    gateway = get_gateway()

    try:
        if not want_live:
            result: Any = {
                "statusCode": 200,
                "message": "Simulated success — no live LOOP call",
                "mode": mode,
                "productId": product_id,
                "echo": body,
                # Simulated runs still get a reference so callers can record
                # them in the ledger and reconcile them like any other run.
                "txnReference": f"SIM-{uuid.uuid4()}",
                "data": {"serviceTransactionStatus": "COMPLETED", "simulated": True},
            }
        elif product_id == "authorisation":
            result = {"message": "Use gateway via any live product; token is cached server-side."}
        elif product_id == "loop-prompt":
            result = gateway.send(
                LOOP_PROMPT,
                {
                    "mobileNo": str(body.get("mobileNo")) if body.get("mobileNo") is not None else None,
                    "amount": str(body.get("amount")) if body.get("amount") is not None else None,
                    "reason": str(body.get("reason") or "Wealth Loop prompt"),
                    "callBackUrl": loop_callback_url("loop-prompt"),
                },
            )
        elif product_id == "mpesa-prompt":
            ext_ref = body.get("extRefNo")
            if ext_ref is None or str(ext_ref).strip() == "":
                ext_ref = f"WL-{uuid.uuid4().hex[:12].upper()}"
            result = gateway.send(
                MPESA_PROMPT,
                {
                    "payMblNo": str(body.get("payMblNo")) if body.get("payMblNo") is not None else None,
                    "amount": str(body.get("amount")) if body.get("amount") is not None else None,
                    "extRefNo": str(ext_ref),
                    "callBackUrl": loop_callback_url("mpesa-prompt"),
                },
            )
        elif product_id == "transaction-inquiry":
            result = gateway.send(
                TRANSACTION_INQUIRY,
                {"txnReference": str(body.get("txnReference")) if body.get("txnReference") is not None else None},
            )
        elif product_id == "transaction-history":
            limit = body.get("limit", 5)
            result = gateway.send(TRANSACTION_HISTORY, {"limit": int(str(limit))})
        elif product_id == "pay-to-loop-till":
            result = gateway.send(PAY_TO_LOOP_TILL, _pay_params(body))
        elif product_id == "pay-to-mpesa-till":
            result = gateway.send(PAY_TO_MPESA_TILL, _pay_params(body))
        elif product_id == "pay-to-paybill":
            result = gateway.send(PAY_TO_PAYBILL, _pay_params(body))
        elif product_id == "send-money-loop":
            # LOOP sandbox gateway rejects this API with "Full authentication is required"
            # even with a valid Bearer token. Keep simulated mode; block misleading live calls.
            if want_live:
                success = False
                error = (
                    "Send Money - Loop live sandbox is unavailable (LOOP returns auth error on "
                    "process-service-request2). Use Send Money - M-Pesa or Mpesa Prompt instead."
                )
                result = {
                    "statusCode": 503,
                    "message": error,
                    "data": {"suggestedProducts": ["send-money-mpesa", "mpesa-prompt"]},
                }
            else:
                result = {
                    "statusCode": 200,
                    "message": "Simulated success — no live LOOP call",
                    "mode": mode,
                    "productId": product_id,
                    "echo": body,
                    "txnReference": f"SIM-{uuid.uuid4()}",
                    "data": {"serviceTransactionStatus": "COMPLETED", "simulated": True},
                }
        elif product_id == "send-money-mpesa":
            result = gateway.send(SEND_MONEY_MPESA, _send_params(body))
        elif product_id == "send-money-pesalink":
            result = gateway.send(SEND_MONEY_PESALINK, _send_params(body))
        else:
            raise ValueError("Unsupported product")
    except Exception as ex:  # noqa: BLE001
        success = False
        error = str(ex)
        result = {"message": str(ex)}

    # Treat LOOP business failures as unsuccessful history entries
    if isinstance(result, dict):
        code = result.get("statusCode")
        if isinstance(code, int) and code >= 400:
            success = False
            error = error or result.get("message")

    entry = {
        "id": str(uuid.uuid4()),
        "productId": product_id,
        "at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "mode": mode,
        "summary": f"{mode} · {product_id}" if success else f"{product_id} failed",
        "request": body,
        "response": result,
        "success": success,
        "error": error,
    }
    history = ensure_history(product_id)
    history.insert(0, entry)
    del history[50:]
    return {"success": success, "mode": mode, "result": result, "entry": entry, "history": history}
