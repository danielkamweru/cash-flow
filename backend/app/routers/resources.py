"""Create, update, and delete the records behind every Wealth surface.

Until now the API could only read seeded rows, so Accounts, Assets, Investments,
Liabilities, Goals, and Bills were fixed at whatever the seed wrote. These
endpoints let a user keep their own books: anything they enter is marked
``user_entered`` and anything the system posts from a real payment movement is
``actual`` — never ``demo``.

Every route resolves through the signed-in user and 404s on an entity that
belongs to someone else, matching the read side.
"""

# NOTE: no `from __future__ import annotations` here. The routes below are
# generated in a factory, and postponed annotations would turn the request-body
# type into the string "create_body", which FastAPI cannot resolve to a model —
# it would silently treat the body as a query parameter instead.

from datetime import datetime, timezone
from typing import Any, Callable

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import Field
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.db import get_db
from app.mappers import (
    account_dto,
    asset_dto,
    goal_dto,
    investment_dto,
    liability_dto,
    obligation_dto,
    transaction_dto,
)
from app.schemas import CamelModel

router = APIRouter(prefix="/api/entities/{entity_id}")

USER_ENTERED = "user_entered"


def _own(db: Session, entity_id: str, user: models.User) -> models.Entity | None:
    entity = db.get(models.Entity, entity_id)
    if entity is None or entity.UserId != user.Id:
        return None
    return entity


def _not_found(what: str = "Entity not found"):
    return JSONResponse(status_code=404, content={"error": what})


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------


class AccountIn(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    provider: str
    institution: str
    balance: float = 0
    currency: str = "KES"
    connection_status: str = "manual"
    account_mask: str | None = None
    is_liquid: bool = True
    is_emergency_reserve: bool = False
    channel: str | None = None


class AccountPatch(CamelModel):
    name: str | None = None
    provider: str | None = None
    institution: str | None = None
    balance: float | None = None
    connection_status: str | None = None
    account_mask: str | None = None
    is_liquid: bool | None = None
    is_emergency_reserve: bool | None = None
    channel: str | None = None


class AssetIn(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    category: str
    value: float
    liquidity: str = "illiquid"


class AssetPatch(CamelModel):
    name: str | None = None
    category: str | None = None
    value: float | None = None
    liquidity: str | None = None


class InvestmentIn(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    type: str
    value: float
    cost_basis: float | None = None
    liquidity: str = "daily"
    risk: str = "low"
    notes: str | None = None


class InvestmentPatch(CamelModel):
    name: str | None = None
    type: str | None = None
    value: float | None = None
    cost_basis: float | None = None
    liquidity: str | None = None
    risk: str | None = None
    notes: str | None = None


class LiabilityIn(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    lender: str
    balance: float
    monthly_payment: float = 0
    interest_rate: float | None = None
    due_day: int | None = None


class LiabilityPatch(CamelModel):
    name: str | None = None
    lender: str | None = None
    balance: float | None = None
    monthly_payment: float | None = None
    interest_rate: float | None = None
    due_day: int | None = None


class GoalIn(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = "other"
    target: float
    current: float = 0
    deadline: datetime
    monthly_contribution: float = 0
    priority: int = 5


class GoalPatch(CamelModel):
    name: str | None = None
    category: str | None = None
    target: float | None = None
    current: float | None = None
    deadline: datetime | None = None
    monthly_contribution: float | None = None
    priority: int | None = None


class ObligationIn(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    amount: float
    due_date: datetime
    category: str = "Other"
    status: str = "upcoming"


class ObligationPatch(CamelModel):
    name: str | None = None
    amount: float | None = None
    due_date: datetime | None = None
    category: str | None = None
    status: str | None = None


class TransactionIn(CamelModel):
    account_id: str
    date: datetime
    description: str = Field(min_length=1, max_length=200)
    amount: float
    category: str = "Other"
    type: str = "outflow"
    apply_to_balance: bool = True


class TransactionPatch(CamelModel):
    description: str | None = None
    amount: float | None = None
    category: str | None = None
    date: datetime | None = None


# ---------------------------------------------------------------------------
# Generic collection wiring
#
# Each resource differs only in its model, DTO, and the fields a write touches,
# so the routes are generated rather than hand-repeated six times.
# ---------------------------------------------------------------------------


def _apply(
    obj: Any,
    payload: CamelModel,
    touch_last_updated: bool = True,
    partial: bool = True,
) -> None:
    """Copy a request body onto a model row.

    Creates apply the full body so schema defaults land on NOT NULL columns;
    patches apply only what the caller actually sent.
    """
    for field, value in payload.model_dump(exclude_unset=partial).items():
        attr = "".join(part.title() for part in field.split("_"))
        if hasattr(obj, attr):
            setattr(obj, attr, value)
    if touch_last_updated and hasattr(obj, "LastUpdated"):
        obj.LastUpdated = _now()


def _register(
    *,
    path: str,
    model: type,
    dto: Callable[[Any], dict],
    create_body: type[CamelModel],
    patch_body: type[CamelModel],
    order_by: Any = None,
    provenance: bool = True,
) -> None:
    """Wire list / create / update / delete for one resource."""

    @router.get(path, name=f"list_{path.strip('/')}")
    def _list(
        entity_id: str,
        user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        if _own(db, entity_id, user) is None:
            return _not_found()
        q = db.query(model).filter(model.EntityId == entity_id)
        if order_by is not None:
            q = q.order_by(order_by)
        return [dto(r) for r in q.all()]

    @router.post(path, status_code=201, name=f"create_{path.strip('/')}")
    def _create(
        entity_id: str,
        body: create_body,  # type: ignore[valid-type]
        user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        if _own(db, entity_id, user) is None:
            return _not_found()
        row = model(EntityId=entity_id)
        if provenance and hasattr(row, "Provenance"):
            row.Provenance = USER_ENTERED
        _apply(row, body, partial=False)
        db.add(row)
        db.commit()
        db.refresh(row)
        return dto(row)

    @router.patch(path + "/{item_id}", name=f"update_{path.strip('/')}")
    def _update(
        entity_id: str,
        item_id: str,
        body: patch_body,  # type: ignore[valid-type]
        user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        if _own(db, entity_id, user) is None:
            return _not_found()
        row = db.get(model, item_id)
        if row is None or row.EntityId != entity_id:
            return _not_found("Record not found")
        _apply(row, body)
        db.commit()
        db.refresh(row)
        return dto(row)

    @router.delete(path + "/{item_id}", name=f"delete_{path.strip('/')}")
    def _delete(
        entity_id: str,
        item_id: str,
        user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        if _own(db, entity_id, user) is None:
            return _not_found()
        row = db.get(model, item_id)
        if row is None or row.EntityId != entity_id:
            return _not_found("Record not found")
        db.delete(row)
        db.commit()
        return {"ok": True, "id": item_id}


_register(path="/accounts", model=models.Account, dto=account_dto,
          create_body=AccountIn, patch_body=AccountPatch, order_by=models.Account.Name)
_register(path="/assets", model=models.Asset, dto=asset_dto,
          create_body=AssetIn, patch_body=AssetPatch, order_by=models.Asset.Name)
_register(path="/investments", model=models.Investment, dto=investment_dto,
          create_body=InvestmentIn, patch_body=InvestmentPatch, order_by=models.Investment.Name)
_register(path="/liabilities", model=models.Liability, dto=liability_dto,
          create_body=LiabilityIn, patch_body=LiabilityPatch, order_by=models.Liability.Name)
_register(path="/goals", model=models.Goal, dto=goal_dto,
          create_body=GoalIn, patch_body=GoalPatch, order_by=models.Goal.Priority, provenance=False)
_register(path="/obligations", model=models.Obligation, dto=obligation_dto,
          create_body=ObligationIn, patch_body=ObligationPatch,
          order_by=models.Obligation.DueDate, provenance=False)


# ---------------------------------------------------------------------------
# Transactions — hand-written because they move account balances
# ---------------------------------------------------------------------------


@router.post("/transactions", status_code=201)
def create_transaction(
    entity_id: str,
    body: TransactionIn,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a transaction by hand and, unless told otherwise, move the balance."""
    if _own(db, entity_id, user) is None:
        return _not_found()
    account = db.get(models.Account, body.account_id)
    if account is None or account.EntityId != entity_id:
        return _not_found("Account not found")
    if body.amount <= 0:
        return JSONResponse(status_code=400, content={"error": "Amount must be greater than zero"})

    tx = models.Transaction(
        EntityId=entity_id,
        AccountId=body.account_id,
        Date=body.date,
        Description=body.description,
        Amount=body.amount,
        Category=body.category,
        Type=body.type,
        Provenance=USER_ENTERED,
        Status="completed",
    )
    db.add(tx)

    if body.apply_to_balance:
        account.Balance += body.amount if body.type == "inflow" else -body.amount
        account.LastUpdated = _now()

    db.commit()
    db.refresh(tx)
    return transaction_dto(tx)


@router.patch("/transactions/{item_id}")
def update_transaction(
    entity_id: str,
    item_id: str,
    body: TransactionPatch,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _own(db, entity_id, user) is None:
        return _not_found()
    tx = db.get(models.Transaction, item_id)
    if tx is None or tx.EntityId != entity_id:
        return _not_found("Transaction not found")

    # Keep the account balance consistent when the amount is corrected.
    if body.amount is not None and body.amount != tx.Amount:
        account = db.get(models.Account, tx.AccountId)
        if account is not None:
            delta = body.amount - tx.Amount
            account.Balance += delta if tx.Type == "inflow" else -delta
            account.LastUpdated = _now()

    _apply(tx, body, touch_last_updated=False)
    db.commit()
    db.refresh(tx)
    return transaction_dto(tx)


@router.delete("/transactions/{item_id}")
def delete_transaction(
    entity_id: str,
    item_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a transaction and unwind its effect on the account balance."""
    if _own(db, entity_id, user) is None:
        return _not_found()
    tx = db.get(models.Transaction, item_id)
    if tx is None or tx.EntityId != entity_id:
        return _not_found("Transaction not found")

    if tx.Status == "completed":
        account = db.get(models.Account, tx.AccountId)
        if account is not None:
            account.Balance += -tx.Amount if tx.Type == "inflow" else tx.Amount
            account.LastUpdated = _now()

    db.delete(tx)
    db.commit()
    return {"ok": True, "id": item_id}


@router.delete("/books")
def clear_books(
    entity_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Wipe every financial record on this entity, keeping the entity itself.

    For a user who would rather enter their own figures than correct the
    opening balances they were given at signup.
    """
    if _own(db, entity_id, user) is None:
        return _not_found()

    removed: dict[str, int] = {}

    # BNPL agreements hang off suppliers, not the entity, so clear them first.
    supplier_ids = [
        s.Id for s in db.query(models.Supplier).filter(models.Supplier.EntityId == entity_id).all()
    ]
    if supplier_ids:
        removed["bnplAgreements"] = (
            db.query(models.BnplAgreement)
            .filter(models.BnplAgreement.SupplierId.in_(supplier_ids))
            .delete(synchronize_session=False)
        )

    # Children before parents so foreign keys stay satisfied: transactions
    # reference accounts, and automation rules reference goals.
    for label, model in (
        ("transactions", models.Transaction),
        ("obligations", models.Obligation),
        ("assets", models.Asset),
        ("investments", models.Investment),
        ("liabilities", models.Liability),
        ("automationRules", models.AutomationRule),
        ("recommendations", models.Recommendation),
        ("activity", models.ActivityEvent),
        ("cashflowMonths", models.CashflowMonth),
        ("invoices", models.Invoice),
        ("suppliers", models.Supplier),
        ("goals", models.Goal),
        ("accounts", models.Account),
    ):
        removed[label] = (
            db.query(model).filter(model.EntityId == entity_id).delete(synchronize_session=False)
        )

    db.commit()
    return {"ok": True, "entityId": entity_id, "removed": removed}
