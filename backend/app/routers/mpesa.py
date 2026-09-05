"""Safaricom Daraja M-Pesa payment endpoints.

POST /api/mpesa/stk-push   — initiate STK Push
POST /api/mpesa/callback   — Safaricom async callback
GET  /api/mpesa/status     — sandbox configuration status
GET  /api/mpesa/payments/{checkout_request_id} — payment lookup
POST /api/mpesa/b2b        — Business Pay Bill payment
GET  /api/mpesa/b2b/payments/{originator_conversation_id} — B2B payment lookup
POST /api/mpesa/b2b/result  — B2B ResultURL callback
POST /api/mpesa/b2b/queue-timeout — B2B QueueTimeOut callback
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.config import get_settings
from app.daraja import get_b2b_service, get_stk_service, normalize_phone
from app.daraja.completion import (
    extract_b2b_result_parameters,
    settle_b2b,
    timeout_b2b,
    track_pending_b2b,
    track_pending_stk,
)
from app.db import get_db

router = APIRouter(prefix="/api/mpesa", tags=["mpesa"])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class STKPushRequest(BaseModel):
    phone_number: str = Field(..., description="Kenyan phone: 07XX, 2547XX, or +2547XX")
    amount: float = Field(..., gt=0, description="Amount in KES")
    account_reference: str = Field(default="CASHFLOW", max_length=12)
    transaction_description: str = Field(default="Cash-Flow payment", max_length=100)
    entity_id: str | None = None
    account_id: str | None = None


class STKPushResponse(BaseModel):
    success: bool
    message: str
    checkout_request_id: str | None = None
    merchant_request_id: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/status")
def mpesa_status():
    """Return safe configuration status — never exposes credentials."""
    s = get_settings()
    configured = s.daraja_configured
    auth_ready = False
    if configured:
        try:
            token = get_stk_service()._auth.get_access_token()
            auth_ready = bool(token)
        except Exception:
            auth_ready = False
    return {
        "success": True,
        "data": {
            "provider": "Safaricom Daraja",
            "environment": "sandbox",
            "paymentMethod": "M-Pesa STK Push",
            "configured": configured,
            "shortcode": s.daraja_shortcode if configured else None,
            "callbackConfigured": bool(s.daraja_callback_url.strip()),
            "portalUrl": "https://developer.safaricom.co.ke",
            "stkPushUrl": s.daraja_stk_push_url,
            "authReady": auth_ready,
            "note": (
                "Daraja credentials loaded. STK Push is ready."
                if configured
                else (
                    "Add DARAJA_CONSUMER_KEY, DARAJA_CONSUMER_SECRET, "
                    "DARAJA_SHORTCODE, and DARAJA_PASSKEY to backend/.env, "
                    "then restart the API."
                )
            ),
        },
    }


@router.post("/stk-push", response_model=STKPushResponse)
def stk_push(
    body: STKPushRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Initiate an M-Pesa STK Push.

    1. Validates and normalises the phone number.
    2. Obtains a Daraja access token (cached).
    3. Sends the STK Push request to Safaricom.
    4. Records a pending transaction in the ledger (if entity_id + account_id provided).
    5. Returns checkout_request_id for status polling.
    """
    # Validate phone before hitting Daraja
    try:
        normalize_phone(body.phone_number)
    except ValueError as exc:
        return JSONResponse(status_code=422, content={"success": False, "message": str(exc)})

    s = get_settings()
    if not s.daraja_configured:
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "message": (
                    "M-Pesa is not configured. Set DARAJA_CONSUMER_KEY, "
                    "DARAJA_CONSUMER_SECRET, DARAJA_SHORTCODE, and DARAJA_PASSKEY "
                    "in backend/.env."
                ),
            },
        )

    try:
        result = get_stk_service().initiate(
            phone_number=body.phone_number,
            amount=body.amount,
            account_reference=body.account_reference,
            transaction_desc=body.transaction_description,
        )
    except ValueError as exc:
        return JSONResponse(status_code=422, content={"success": False, "message": str(exc)})
    except RuntimeError as exc:
        return JSONResponse(status_code=502, content={"success": False, "message": str(exc)})

    checkout_request_id = result.get("CheckoutRequestID")
    merchant_request_id = result.get("MerchantRequestID")

    # Record pending transaction in the ledger
    if body.entity_id and body.account_id and checkout_request_id:
        try:
            track_pending_stk(
                db,
                entity_id=body.entity_id,
                account_id=body.account_id,
                amount=float(body.amount),
                checkout_request_id=checkout_request_id,
                description=f"M-Pesa STK Push — {body.account_reference}",
            )
        except Exception:  # noqa: BLE001
            pass  # Ledger failure must not block the payment response

    return STKPushResponse(
        success=True,
        message="STK Push initiated. Check your phone to complete the M-Pesa payment.",
        checkout_request_id=checkout_request_id,
        merchant_request_id=merchant_request_id,
    )


@router.post("/callback")
async def mpesa_callback(request: Request, db: Session = Depends(get_db)):
    """Receive Safaricom's async STK Push callback.

    Safaricom posts a JSON body. We parse it safely, locate the pending
    transaction by CheckoutRequestID, and update its status.

    Idempotent: duplicate callbacks for the same CheckoutRequestID are ignored.
    """
    try:
        payload: dict[str, Any] = await request.json()
    except Exception:
        # Malformed body — acknowledge so Safaricom stops retrying
        return {"ResultCode": 0, "ResultDesc": "Accepted"}

    try:
        body = payload.get("Body", {})
        stk_callback = body.get("stkCallback", {})
        result_code = stk_callback.get("ResultCode")
        checkout_request_id = stk_callback.get("CheckoutRequestID")

        if not checkout_request_id:
            return {"ResultCode": 0, "ResultDesc": "Accepted"}

        success = result_code == 0
        mpesa_receipt: str | None = None

        if success:
            # Extract M-Pesa receipt number from CallbackMetadata
            metadata = stk_callback.get("CallbackMetadata", {})
            for item in metadata.get("Item", []):
                if item.get("Name") == "MpesaReceiptNumber":
                    mpesa_receipt = str(item.get("Value", ""))
                    break

        settle_stk(
            db,
            checkout_request_id=checkout_request_id,
            success=success,
            mpesa_receipt=mpesa_receipt,
        )
    except Exception:  # noqa: BLE001
        # Never let a processing error cause a non-200 — Safaricom would retry
        pass
    # Safaricom expects this exact acknowledgement shape
    return {"ResultCode": 0, "ResultDesc": "Accepted"}


@router.get("/payments/{checkout_request_id}")
def get_payment(
    checkout_request_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Look up a payment by its Daraja CheckoutRequestID."""
    tx = (
        db.query(models.Transaction)
        .filter(models.Transaction.PaymentReference == checkout_request_id)
        .one_or_none()
    )
    if tx is None:
        return JSONResponse(status_code=404, content={"success": False, "message": "Payment not found"})
    return {
        "success": True,
        "data": {
            "checkoutRequestId": checkout_request_id,
            "status": tx.Status,
            "amount": tx.Amount,
            "description": tx.Description,
            "date": tx.Date.isoformat().replace("+00:00", "Z"),
        },
    }


# ---------------------------------------------------------------------------
# B2B — Business Buy Goods
# ---------------------------------------------------------------------------

class B2BPaymentRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Amount in KES")
    account_reference: str = Field(..., max_length=13, description="≤13 chars per Daraja contract")
    party_b: str | None = Field(default=None, max_length=20, description="Receiver shortcode (defaults to configured PartyB)")
    requester: str | None = Field(default=None, description="Optional customer phone 07XX/2547XX/+2547XX")
    remarks: str = Field(default="Cash-Flow B2B", max_length=100)
    entity_id: str | None = None
    account_id: str | None = None


class B2BPaymentResponse(BaseModel):
    success: bool
    message: str
    originator_conversation_id: str | None = None
    conversation_id: str | None = None
    response_code: str | None = None
    response_description: str | None = None
    # Idempotency key for the frontend to poll status
    reference: str | None = None


@router.post("/b2b", response_model=B2BPaymentResponse)
def b2b_payment(
    body: B2BPaymentRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Initiate a Safaricom Daraja Business Buy Goods (B2B) payment.

    The initial Daraja response (ResponseCode 0) only means the request was
    accepted. The transaction is recorded in the SUBMITTED state and the
    final status arrives asynchronously via the ResultURL callback.
    """
    s = get_settings()
    if not s.daraja_b2b_configured:
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "message": (
                    "B2B is not configured. Set DARAJA_B2B_INITIATOR, "
                    "DARAJA_B2B_SECURITY_CREDENTIAL, DARAJA_B2B_PARTY_A, "
                    "DARAJA_B2B_PARTY_B, DARAJA_B2B_RESULT_URL and "
                    "DARAJA_B2B_QUEUE_TIMEOUT_URL in backend/.env."
                ),
            },
        )

    try:
        result = get_b2b_service().payment_request(
            amount=body.amount,
            account_reference=body.account_reference,
            party_b=body.party_b,
            requester=body.requester,
            remarks=body.remarks,
        )
    except ValueError as exc:
        return JSONResponse(status_code=422, content={"success": False, "message": str(exc)})
    except RuntimeError as exc:
        return JSONResponse(status_code=502, content={"success": False, "message": str(exc)})

    originator = result.get("OriginatorConversationID")
    conversation = result.get("ConversationID")
    response_code = str(result.get("ResponseCode", ""))
    response_description = result.get("ResponseDescription", "")

    if response_code != "0":
        return JSONResponse(
            status_code=502,
            content={
                "success": False,
                "message": f"Daraja B2B rejected the request: {response_description}",
                "originator_conversation_id": originator,
                "conversation_id": conversation,
                "response_code": response_code,
                "response_description": response_description,
            },
        )

    # Record the SUBMITTED transaction in the ledger (if entity + account supplied).
    if body.entity_id and body.account_id and (originator or conversation):
        try:
            track_pending_b2b(
                db,
                entity_id=body.entity_id,
                account_id=body.account_id,
                amount=float(body.amount),
                originator_conversation_id=originator or "",
                conversation_id=conversation or "",
                party_a=s.daraja_b2b_party_a,
                party_b=(body.party_b or s.daraja_b2b_party_b),
                account_reference=body.account_reference[:13],
                description=f"M-Pesa B2B — {body.account_reference}",
                requester=body.requester,
            )
        except Exception:  # noqa: BLE001
            # Ledger failure must not block the payment response.
            pass

    return B2BPaymentResponse(
        success=True,
        message="B2B payment submitted. Awaiting Daraja ResultURL confirmation.",
        originator_conversation_id=originator,
        conversation_id=conversation,
        response_code=response_code,
        response_description=response_description,
        reference=originator or conversation,
    )


@router.post("/b2b/pay-goods", response_model=B2BPaymentResponse)
def b2b_pay_goods(
    body: B2BPaymentRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Initiate a Business-to-Business (Buy Goods) payment via Daraja.

    The transaction is only completed after Safaricom POSTs the ResultURL
    callback with ResultCode == 0.
    """
    s = get_settings()
    if not s.daraja_b2b_configured:
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "message": (
                    "B2B is not configured. Set DARAJA_B2B_INITIATOR, "
                    "DARAJA_B2B_SECURITY_CREDENTIAL, DARAJA_B2B_PARTY_A, "
                    "DARAJA_B2B_PARTY_B, DARAJA_B2B_RESULT_URL, and "
                    "DARAJA_B2B_QUEUE_TIMEOUT_URL in backend/.env."
                ),
            },
        )

    phone = None
    if body.requester:
        try:
            phone = normalize_phone(body.requester)
        except ValueError:
            phone = body.requester

    try:
        result = get_b2b_service().business_pay_goods_request(
            amount=float(body.amount),
            account_reference=body.account_reference,
            party_b=body.party_b or s.daraja_b2b_party_b,
            requester=phone,
            remarks=body.remarks,
        )
    except ValueError as exc:
        return JSONResponse(status_code=422, content={"success": False, "message": str(exc)})
    except RuntimeError as exc:
        error_msg = str(exc)
        return JSONResponse(
            status_code=502,
            content={
                "success": False,
                "message": f"Daraja B2B Buy Goods error: {error_msg}",
                "darajaError": error_msg,
            },
        )

    originator = result.get("OriginatorConversationID")
    conversation = result.get("ConversationID")
    response_code = result.get("ResponseCode")
    response_description = result.get("ResponseDescription")

    # Record the SUBMITTED transaction in the ledger (if entity + account supplied).
    if body.entity_id and body.account_id and (originator or conversation):
        try:
            track_pending_b2b(
                db,
                entity_id=body.entity_id,
                account_id=body.account_id,
                amount=float(body.amount),
                originator_conversation_id=originator or "",
                conversation_id=conversation or "",
                party_a=s.daraja_b2b_party_a,
                party_b=(body.party_b or s.daraja_b2b_party_b),
                account_reference=body.account_reference[:13],
                description=f"M-Pesa B2B Buy Goods — {body.account_reference}",
                requester=body.requester,
            )
        except Exception:  # noqa: BLE001
            # Ledger failure must not block the payment response.
            pass

    return B2BPaymentResponse(
        success=True,
        message="B2B Buy Goods payment submitted. Awaiting Daraja ResultURL confirmation.",
        originator_conversation_id=originator,
        conversation_id=conversation,
        response_code=response_code,
        response_description=response_description,
        reference=originator or conversation,
    )


@router.get("/b2b/payments/{originator_conversation_id}")
def get_b2b_payment(
    originator_conversation_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Look up a B2B payment by its OriginatorConversationID."""
    tx = (
        db.query(models.Transaction)
        .filter(models.Transaction.PaymentReference == originator_conversation_id)
        .one_or_none()
    )
    if tx is None:
        return JSONResponse(
            status_code=404, content={"success": False, "message": "Payment not found"}
        )
    meta = tx.Metadata or {}
    return {
        "success": True,
        "data": {
            "originatorConversationId": originator_conversation_id,
            "status": tx.Status,
            "amount": tx.Amount,
            "description": tx.Description,
            "date": tx.Date.isoformat().replace("+00:00", "Z"),
            "partyA": meta.get("party_a"),
            "partyB": meta.get("party_b"),
            "accountReference": meta.get("account_reference"),
            "resultCode": meta.get("result_code"),
            "resultDesc": meta.get("result_desc"),
            "transactionId": meta.get("transaction_id"),
        },
    }


# ---------------------------------------------------------------------------
# B2B asynchronous callbacks (Safaricom → Cash-Flow)
# ---------------------------------------------------------------------------

@router.post("/b2b/result")
async def b2b_result_callback(request: Request, db: Session = Depends(get_db)):
    """Receive Safaricom's B2B ResultURL callback.

    Body shape:
        {
          "Result": {
            "ResultType": 0,
            "ResultCode": 0,
            "ResultDesc": "...",
            "OriginatorConversationID": "...",
            "ConversationID": "...",
            "TransactionID": "QKA81LK5CY",
            "ResultParameters": { "ResultParameter": [...] }
          }
        }

    Idempotent: duplicate callbacks for the same conversation ID are ignored.
    """
    try:
        payload: dict[str, Any] = await request.json()
    except Exception:
        return {"ResultCode": 0, "ResultDesc": "Accepted"}

    try:
        result = payload.get("Result") or {}
        result_code = result.get("ResultCode")
        result_desc = result.get("ResultDesc")
        originator = result.get("OriginatorConversationID")
        conversation = result.get("ConversationID")
        transaction_id = result.get("TransactionID")
        parameters = result.get("ResultParameters", {}).get("ResultParameter", [])

        extra = extract_b2b_result_parameters(parameters)

        settle_b2b(
            db,
            originator_conversation_id=originator,
            conversation_id=conversation,
            result_code=result_code,
            result_desc=result_desc,
            transaction_id=transaction_id,
            extra_parameters=extra,
        )
    except Exception:  # noqa: BLE001
        # Never let a processing error break the acknowledgement — Safaricom
        # would otherwise retry indefinitely.
        pass

    # Safaricom requires this acknowledgement shape.
    return {"ResultCode": 0, "ResultDesc": "Accepted"}


@router.post("/b2b/queue-timeout")
async def b2b_queue_timeout_callback(request: Request, db: Session = Depends(get_db)):
    """Receive Safaricom's B2B QueueTimeOutURL callback.

    Called when the B2B request never produced a deterministic result within
    the queue window. We mark the transaction as ``timeout`` and acknowledge.
    """
    try:
        payload: dict[str, Any] = await request.json()
    except Exception:
        return {"ResultCode": 0, "ResultDesc": "Accepted"}

    try:
        result = payload.get("Result") or payload
        originator = result.get("OriginatorConversationID")
        conversation = result.get("ConversationID")

        timeout_b2b(
            db,
            originator_conversation_id=originator,
            conversation_id=conversation,
        )
    except Exception:  # noqa: BLE001
        pass

    return {"ResultCode": 0, "ResultDesc": "Accepted"}
