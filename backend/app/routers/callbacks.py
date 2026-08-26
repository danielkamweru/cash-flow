from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.loop.completion import complete_pending_transaction

router = APIRouter(prefix="/api/loop/callbacks")

_received: list[dict[str, Any]] = []

# LOOP is not consistent about which field carries the outcome, so accept the
# codes every product has been observed to send for a settled payment.
_SUCCESS_CODES = {"200", "0", "success", "completed", "true"}


def _record(kind: str, body: str) -> None:
    _received.insert(
        0,
        {
            "at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "kind": kind,
            "payload": body,
        },
    )
    del _received[50:]


def _settle(db: Session, body: str) -> None:
    """Settle the matching pending transaction, if the payload identifies one."""
    try:
        payload = json.loads(body)
    except (ValueError, TypeError):
        return
    if not isinstance(payload, dict):
        return

    inner = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    txn_reference = (
        payload.get("txnReference")
        or payload.get("TxnReference")
        or inner.get("txnReference")
    )
    if not txn_reference:
        return

    raw_status = (
        payload.get("statusCode")
        or payload.get("status")
        or payload.get("resultCode")
        or inner.get("statusCode")
        or inner.get("status")
    )
    success = str(raw_status).strip().lower() in _SUCCESS_CODES
    complete_pending_transaction(db, txn_reference=str(txn_reference), success=success)


@router.get("")
@router.get("/")
def list_callbacks():
    return {"success": True, "data": _received}


@router.post("/mpesa-prompt")
async def mpesa_prompt_callback(request: Request, db: Session = Depends(get_db)):
    body = (await request.body()).decode("utf-8", errors="replace")
    _record("mpesa-prompt", body)
    _settle(db, body)
    return {"success": True}


@router.post("/loop-prompt")
async def loop_prompt_callback(request: Request, db: Session = Depends(get_db)):
    body = (await request.body()).decode("utf-8", errors="replace")
    _record("loop-prompt", body)
    _settle(db, body)
    return {"success": True}
