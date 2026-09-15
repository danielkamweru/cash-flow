"""Ledger helpers for Daraja M-Pesa payments.

These record Cash-Flow transactions and update account balances
in a provider-agnostic way.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app import models
from app.config import get_settings
from app.db import SessionLocal

logger = logging.getLogger("cash-flow.mpesa")


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

        # In sandbox mode there is no real money storage, so every successfully
        # settled STK Push inflow is reversed after a short delay.  The timer
        # worker opens its own DB session so this request is not blocked.
        schedule_reversal(
            entity_id=tx.EntityId,
            account_id=tx.AccountId,
            checkout_request_id=tx.PaymentReference,
        )

    db.commit()
    db.refresh(tx)
    return tx


# ---------------------------------------------------------------------------
# Sandbox reversal — STK Push payments are simulated and auto-reversed
# after a short delay because there is no real money storage.
# ---------------------------------------------------------------------------

REVERSAL_DELAY_SECONDS: float = 5.0


def reverse_stk(
    db: Session,
    *,
    entity_id: str | None = None,
    account_id: str | None = None,
    checkout_request_id: str | None = None,
) -> list[models.Transaction]:
    """Reverse completed STK Push inflow transactions.

    In sandbox mode STK Push payments are simulated — there is no real
    money storage. This undoes the account-balance credit granted when the
    transaction was settled, marking each transaction ``"reversed"``.

    When reversing multiple transactions the **largest amounts are reversed
    first** so that bigger flows settle before smaller ones, as is customary
    for reconciliation.

    Args:
        db: Database session (committed and refreshed by this call).
        entity_id: Optional entity filter. When omitted, all matching
            transactions for the given account / checkout id are reversed.
        account_id: Optional account filter.
        checkout_request_id: If given, reverse only this single transaction.

    Returns:
        The list of transactions that were actually reversed (oldest
        settlement is kept; already-reversed rows are skipped).
    """

    query = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.Type == "inflow",
            models.Transaction.Category == "M-Pesa",
            models.Transaction.Status == "completed",
        )
        .order_by(models.Transaction.Amount.desc())
    )

    if entity_id is not None:
        query = query.filter(models.Transaction.EntityId == entity_id)
    if account_id is not None:
        query = query.filter(models.Transaction.AccountId == account_id)
    if checkout_request_id is not None:
        query = query.filter(models.Transaction.PaymentReference == checkout_request_id)

    txs = query.all()
    reversed_txs: list[models.Transaction] = []

    for tx in txs:
        # Defensive: the query filters by Status == "completed", but guard
        # again so a caller passing a wider query cannot double-reverse.
        if tx.Status != "completed":
            continue
        tx.Status = "reversed"
        account = db.get(models.Account, tx.AccountId)
        if account is not None:
            account.Balance -= tx.Amount
            account.LastUpdated = _now()
        tx.Description = f"{tx.Description} · reversed (simulated)"
        tx.Metadata = {
            **(tx.Metadata or {}),
            "reversed_at": _now().isoformat(),
            "reversal_reason": "sandbox_simulated_no_storage",
        }
        reversed_txs.append(tx)

    if reversed_txs:
        db.commit()
        for tx in reversed_txs:
            db.refresh(tx)

    return reversed_txs


def _reversal_worker(
    entity_id: str | None,
    account_id: str | None,
    checkout_request_id: str | None,
) -> None:
    """Background worker that performs the delayed reversal.

    Opens a fresh DB session so the request that triggered the settlement
    is never blocked by the delay.
    """

    db = SessionLocal()
    try:
        reversed_txs = reverse_stk(
            db,
            entity_id=entity_id,
            account_id=account_id,
            checkout_request_id=checkout_request_id,
        )
        if reversed_txs:
            logger.info(
                "Reversed %d simulated STK payment(s) for entity %s "
                "(largest-first: %s)",
                len(reversed_txs),
                entity_id,
                [round(t.Amount, 2) for t in reversed_txs],
            )
    except Exception:  # noqa: BLE001
        logger.exception("Failed to reverse simulated STK payments")
        db.rollback()
    finally:
        db.close()


def schedule_reversal(
    *,
    entity_id: str | None = None,
    account_id: str | None = None,
    checkout_request_id: str | None = None,
    delay: float | None = None,
) -> threading.Timer | None:
    """Schedule a delayed reversal of completed STK payments.

    Returns the ``threading.Timer`` handle, or ``None`` when reversal is
    disabled (non-sandbox or ``daraja_simulated_reversal_seconds == 0``).
    """

    settings = get_settings()
    if not settings.is_sandbox:
        return None
    wait = delay if delay is not None else float(settings.daraja_simulated_reversal_seconds)
    if wait <= 0:
        return None

    timer = threading.Timer(
        wait,
        _reversal_worker,
        args=(entity_id, account_id, checkout_request_id),
    )
    timer.daemon = True
    timer.start()
    return timer


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


# ---------------------------------------------------------------------------
# B2C helpers — track and settle BusinessPayToBulk / Account Top Up
# ---------------------------------------------------------------------------

def track_pending_b2c(
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
    """Record a B2C transaction in the SUBMITTED state.

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
        "provider": "daraja_b2c",
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
        Category="M-Pesa B2C",
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


def settle_b2c(
    db: Session,
    *,
    originator_conversation_id: str | None,
    conversation_id: str | None,
    result_code: int | str,
    result_desc: str | None,
    transaction_id: str | None = None,
    extra_parameters: dict | None = None,
) -> models.Transaction | None:
    """Apply the async B2C ResultURL callback to a tracked transaction.

    Idempotent: if the transaction is already terminal (completed / failed),
    subsequent callbacks for the same conversation are ignored.
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

    if success:
        _touch(db.get(models.Account, tx.AccountId), -tx.Amount)
        if transaction_id:
            tx.Description = f"{tx.Description} · {transaction_id}"

    db.commit()
    db.refresh(tx)
    return tx


def timeout_b2c(
    db: Session,
    *,
    originator_conversation_id: str | None,
    conversation_id: str | None,
) -> models.Transaction | None:
    """Mark a B2C transaction as timed out."""
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
