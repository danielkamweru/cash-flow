"""Ledger helpers for Daraja M-Pesa payments.

These record Cash-Flow transactions and update account balances
in a provider-agnostic way.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app import models


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _touch(account: models.Account | None, delta: float) -> None:
    if account is None:
        return
    account.Balance += delta
    account.LastUpdated = _now()


def track_pending_stk(
    db: Session,
    *,
    entity_id: str,
    account_id: str,
    amount: float,
    checkout_request_id: str,
    description: str,
    provenance: str = "actual",
) -> models.Transaction:
    """Record a pending STK Push transaction before the callback arrives."""
    tx = models.Transaction(
        EntityId=entity_id,
        AccountId=account_id,
        Date=_now(),
        Description=description,
        Amount=amount,
        Category="M-Pesa",
        Type="inflow",
        Provenance=provenance,
        # Reuse the existing PaymentReference column to store the Daraja
        # CheckoutRequestID so the callback can locate this record.
        PaymentReference=checkout_request_id,
        Status="pending",
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def settle_stk(
    db: Session,
    *,
    checkout_request_id: str,
    success: bool,
    mpesa_receipt: str | None = None,
) -> models.Transaction | None:
    """Settle a pending STK transaction from the Daraja callback.

    Idempotent: if the transaction is already settled, returns it unchanged.
    """
    tx = (
        db.query(models.Transaction)
        .filter(models.Transaction.PaymentReference == checkout_request_id)
        .one_or_none()
    )
    if tx is None:
        return None
    if tx.Status != "pending":
        # Already settled — duplicate callback, do nothing.
        return tx

    tx.Status = "completed" if success else "failed"
    if success:
        _touch(db.get(models.Account, tx.AccountId), tx.Amount)
        # Append receipt to description if provided
        if mpesa_receipt:
            tx.Description = f"{tx.Description} · {mpesa_receipt}"

    db.commit()
    db.refresh(tx)
    return tx


def record_mpesa_payment(
    db: Session,
    *,
    entity_id: str,
    account_id: str,
    amount: float,
    checkout_request_id: str,
    description: str,
    category: str = "M-Pesa",
    liability_id: str | None = None,
    obligation_id: str | None = None,
    provenance: str = "actual",
) -> models.Transaction:
    """Record a completed outbound M-Pesa payment immediately."""
    tx = models.Transaction(
        EntityId=entity_id,
        AccountId=account_id,
        Date=_now(),
        Description=description,
        Amount=amount,
        Category=category,
        Type="outflow",
        Provenance=provenance,
        PaymentReference=checkout_request_id,
        Status="completed",
    )
    db.add(tx)
    _touch(db.get(models.Account, account_id), -amount)

    if liability_id:
        liability = db.get(models.Liability, liability_id)
        if liability is not None:
            liability.Balance = max(0.0, liability.Balance - amount)
            liability.LastUpdated = _now()

    if obligation_id:
        obligation = db.get(models.Obligation, obligation_id)
        if obligation is not None:
            obligation.Status = "paid"

    db.commit()
    db.refresh(tx)
    return tx


# ---------------------------------------------------------------------------
# B2B helpers — track and settle Business Buy Goods payments
# ---------------------------------------------------------------------------

def track_pending_b2b(
    db: Session,
    *,
    entity_id: str,
    account_id: str,
    amount: float,
    originator_conversation_id: str,
    conversation_id: str,
    party_a: str,
    party_b: str,
    account_reference: str,
    description: str,
    requester: str | None = None,
) -> models.Transaction | None:
    """Record a B2B transaction in the SUBMITTED state.

    The transaction is only completed by settle_b2b() after Daraja POSTs the
    ResultURL callback with ``Result.ResultCode == 0``.

    Idempotent: a duplicate (OriginatorConversationID, ConversationID) pair
    is rejected — the existing row is returned unchanged.
    """
    if not originator_conversation_id and not conversation_id:
        return None

    existing = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.Metadata["originator_conversation_id"].astext
            == originator_conversation_id
        )
        .one_or_none()
    )
    if existing is not None:
        return existing

    metadata = {
        "provider": "daraja_b2b",
        "originator_conversation_id": originator_conversation_id,
        "conversation_id": conversation_id,
        "party_a": party_a,
        "party_b": party_b,
        "account_reference": account_reference,
    }
    if requester:
        metadata["requester"] = requester

    tx = models.Transaction(
        EntityId=entity_id,
        AccountId=account_id,
        Date=_now(),
        Description=description,
        Amount=amount,
        Category="M-Pesa B2B",
        Type="outflow",
        Provenance="actual",
        PaymentReference=originator_conversation_id or conversation_id,
        Status="submitted",
        Metadata=metadata,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def settle_b2b(
    db: Session,
    *,
    originator_conversation_id: str | None,
    conversation_id: str | None,
    result_code: int | str,
    result_desc: str | None,
    transaction_id: str | None = None,
    extra_parameters: dict | None = None,
) -> models.Transaction | None:
    """Apply the async B2B ResultURL callback to a tracked transaction.

    Idempotent: if the transaction is already terminal (completed / failed),
    subsequent callbacks for the same conversation are ignored. The same
    behaviour applies to duplicate settlements.
    """
    if not originator_conversation_id and not conversation_id:
        return None

    tx: models.Transaction | None = None
    if originator_conversation_id:
        tx = (
            db.query(models.Transaction)
            .filter(
                models.Transaction.Metadata["originator_conversation_id"].astext
                == originator_conversation_id
            )
            .one_or_none()
        )
    if tx is None and conversation_id:
        tx = (
            db.query(models.Transaction)
            .filter(
                models.Transaction.Metadata["conversation_id"].astext
                == conversation_id
            )
            .one_or_none()
        )
    if tx is None:
        return None

    # Already settled — duplicate callback, do nothing.
    if tx.Status in ("completed", "failed", "timeout"):
        return tx

    success = str(result_code) == "0"
    tx.Status = "completed" if success else "failed"

    existing_meta = dict(tx.Metadata or {})
    existing_meta.update(
        {
            "result_code": str(result_code),
            "result_desc": result_desc,
        }
    )
    if transaction_id:
        existing_meta["transaction_id"] = transaction_id
    if extra_parameters:
        existing_meta["result_parameters"] = extra_parameters
    tx.Metadata = existing_meta

    # If completed, update the account balance and persist the receipt
    # on the description for traceability.
    if success:
        _touch(db.get(models.Account, tx.AccountId), -tx.Amount)
        if transaction_id:
            tx.Description = f"{tx.Description} · {transaction_id}"

    db.commit()
    db.refresh(tx)
    return tx


def timeout_b2b(
    db: Session,
    *,
    originator_conversation_id: str | None,
    conversation_id: str | None,
) -> models.Transaction | None:
    """Mark a B2B transaction as timed out.

    Safaricom's QueueTimeOutURL is hit when the B2B request never gets a
    deterministic result within the queue window. We mark the row as
    ``timeout`` and return it. A late successful ResultURL callback will
    still settle the row.
    """
    if not originator_conversation_id and not conversation_id:
        return None

    tx: models.Transaction | None = None
    if originator_conversation_id:
        tx = (
            db.query(models.Transaction)
            .filter(
                models.Transaction.Metadata["originator_conversation_id"].astext
                == originator_conversation_id
            )
            .one_or_none()
        )
    if tx is None and conversation_id:
        tx = (
            db.query(models.Transaction)
            .filter(
                models.Transaction.Metadata["conversation_id"].astext
                == conversation_id
            )
            .one_or_none()
        )
    if tx is None:
        return None

    if tx.Status in ("completed", "failed", "timeout"):
        return tx

    tx.Status = "timeout"
    existing_meta = dict(tx.Metadata or {})
    existing_meta["queue_timeout"] = True
    tx.Metadata = existing_meta
    db.commit()
    db.refresh(tx)
    return tx


def extract_b2b_result_parameters(parameters: list | None) -> dict:
    """Safely extract known keys from a Daraja B2B ResultParameter list."""
    if not parameters:
        return {}
    out: dict = {}
    for item in parameters:
        if not isinstance(item, dict):
            continue
        key = item.get("Key")
        value = item.get("Value")
        if key is None:
            continue
        out[str(key)] = value
    return out
