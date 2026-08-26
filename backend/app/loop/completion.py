"""Turn LOOP gateway responses into ledger movements.

Prompt products (STK / RTP) are asynchronous: the gateway only acknowledges that
the prompt was pushed, so we record a *pending* transaction and settle it later
from the callback or a status inquiry. Pay-to-till and send-money are
synchronous: a 200 means the money already moved, so we post the transaction and
apply its side effects immediately.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app import models


def is_success(result: dict) -> bool:
    return result.get("statusCode") in (200, "200")


def _touch(account: models.Account | None, delta: float) -> None:
    if account is None:
        return
    account.Balance += delta
    account.LastUpdated = datetime.now(timezone.utc)


def track_pending_topup(
    db: Session,
    *,
    entity_id: str,
    account_id: str,
    amount: float,
    txn_reference: str,
    description: str,
    provenance: str = "actual",
) -> models.Transaction:
    tx = models.Transaction(
        EntityId=entity_id,
        AccountId=account_id,
        Date=datetime.now(timezone.utc),
        Description=description,
        Amount=amount,
        Category="Top-up",
        Type="inflow",
        Provenance=provenance,
        LoopTxnReference=txn_reference,
        Status="pending",
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def complete_pending_transaction(
    db: Session, *, txn_reference: str, success: bool
) -> models.Transaction | None:
    tx = (
        db.query(models.Transaction)
        .filter(models.Transaction.LoopTxnReference == txn_reference)
        .one_or_none()
    )
    if tx is None or tx.Status != "pending":
        return tx
    tx.Status = "completed" if success else "failed"
    if success and tx.Type == "inflow":
        _touch(db.get(models.Account, tx.AccountId), tx.Amount)
        _settle_invoice(db, txn_reference=txn_reference, amount=tx.Amount)
    db.commit()
    db.refresh(tx)
    return tx


def _settle_invoice(db: Session, *, txn_reference: str, amount: float) -> None:
    """A collected prompt is what marks its invoice paid."""
    invoice = (
        db.query(models.Invoice)
        .filter(models.Invoice.LoopTxnReference == txn_reference)
        .one_or_none()
    )
    if invoice is None:
        return
    invoice.AmountPaid = min(invoice.Amount, (invoice.AmountPaid or 0) + amount)
    invoice.Status = "paid" if invoice.AmountPaid >= invoice.Amount else "part_paid"


def record_completed_payment(
    db: Session,
    *,
    entity_id: str,
    account_id: str,
    amount: float,
    txn_reference: str,
    description: str,
    category: str,
    liability_id: str | None = None,
    obligation_id: str | None = None,
    provenance: str = "actual",
) -> models.Transaction:
    tx = models.Transaction(
        EntityId=entity_id,
        AccountId=account_id,
        Date=datetime.now(timezone.utc),
        Description=description,
        Amount=amount,
        Category=category,
        Type="outflow",
        Provenance=provenance,
        LoopTxnReference=txn_reference,
        Status="completed",
    )
    db.add(tx)
    _touch(db.get(models.Account, account_id), -amount)

    if liability_id:
        liability = db.get(models.Liability, liability_id)
        if liability is not None:
            liability.Balance = max(0.0, liability.Balance - amount)
            liability.LastUpdated = datetime.now(timezone.utc)

    if obligation_id:
        obligation = db.get(models.Obligation, obligation_id)
        if obligation is not None:
            obligation.Status = "paid"

    db.commit()
    db.refresh(tx)
    return tx


def record_completed_send_money(
    db: Session,
    *,
    entity_id: str,
    account_id: str,
    amount: float,
    txn_reference: str,
    description: str,
    goal_id: str | None = None,
    automation_rule_id: str | None = None,
    provenance: str = "actual",
) -> models.Transaction:
    tx = record_completed_payment(
        db,
        entity_id=entity_id,
        account_id=account_id,
        amount=amount,
        txn_reference=txn_reference,
        description=description,
        category="Send money",
        provenance=provenance,
    )

    if goal_id:
        goal = db.get(models.Goal, goal_id)
        if goal is not None:
            goal.Current += amount

    if automation_rule_id:
        rule = db.get(models.AutomationRule, automation_rule_id)
        if rule is not None:
            now = datetime.now(timezone.utc)
            rule.AuthorizedAt = rule.AuthorizedAt or now
            rule.ExecutedAt = now
            rule.Status = "active_demo"

    db.commit()
    db.refresh(tx)
    return tx


def log_activity(db: Session, *, entity_id: str, title: str, detail: str, kind: str = "system") -> None:
    db.add(
        models.ActivityEvent(
            EntityId=entity_id,
            Timestamp=datetime.now(timezone.utc),
            Title=title,
            Detail=detail,
            Kind=kind,
        )
    )
    db.commit()
