"""Execute an advisor recommendation.

The Advisor page proposes concrete moves — put KES 12,000 a month into a money
market fund, add KES 5,000 toward a goal, clear a liability. This turns any of
those into real records: money leaves the funding account, the destination
(investment, goal, or liability) is updated, and a transaction is written so the
ledger explains where it went.

External money movement (M-Pesa STK Push) is handled separately via
POST /api/mpesa/stk-push. These endpoints record the internal ledger side.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import Field
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.db import get_db
from app.mappers import goal_dto, investment_dto, liability_dto, transaction_dto
from app.schemas import CamelModel

router = APIRouter(prefix="/api/entities/{entity_id}/actions")

INSTRUMENT_DEFAULTS = {
    "mmf":        {"liquidity": "daily",    "risk": "low",      "label": "Money Market Fund"},
    "sacco":      {"liquidity": "locked",   "risk": "moderate", "label": "SACCO deposits"},
    "tbill":      {"liquidity": "maturity", "risk": "low",      "label": "Treasury Bill"},
    "tbond":      {"liquidity": "tplus2",   "risk": "moderate", "label": "Treasury Bond"},
    "infra_bond": {"liquidity": "maturity", "risk": "moderate", "label": "Infrastructure Bond"},
    "nse":        {"liquidity": "tplus2",   "risk": "elevated", "label": "NSE equities"},
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _own(db: Session, entity_id: str, user: models.User) -> models.Entity | None:
    entity = db.get(models.Entity, entity_id)
    if entity is None or entity.UserId != user.Id:
        return None
    return entity


class InvestRequest(CamelModel):
    account_id: str
    amount: float = Field(gt=0)
    instrument: str = "mmf"
    investment_id: str | None = None
    name: str | None = None


class GoalFundRequest(CamelModel):
    account_id: str
    goal_id: str
    amount: float = Field(gt=0)


class DebtPaymentRequest(CamelModel):
    account_id: str
    liability_id: str
    amount: float = Field(gt=0)


def _debit(account: models.Account, amount: float) -> None:
    account.Balance -= amount
    account.LastUpdated = _now()


@router.post("/invest")
def invest(
    entity_id: str,
    body: InvestRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _own(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})

    account = db.get(models.Account, body.account_id)
    if account is None or account.EntityId != entity_id:
        return JSONResponse(status_code=404, content={"error": "Account not found"})
    if account.Balance < body.amount:
        return JSONResponse(
            status_code=400,
            content={"error": f"Not enough in {account.Name} — balance is {account.Balance:,.2f}"},
        )

    spec = INSTRUMENT_DEFAULTS.get(body.instrument)
    if spec is None:
        return JSONResponse(status_code=400, content={"error": f"Unknown instrument '{body.instrument}'"})

    holding = None
    if body.investment_id:
        holding = db.get(models.Investment, body.investment_id)
        if holding is None or holding.EntityId != entity_id:
            return JSONResponse(status_code=404, content={"error": "Investment not found"})

    if holding is None:
        holding = models.Investment(
            EntityId=entity_id,
            Name=body.name or spec["label"],
            Type=body.instrument,
            Value=0.0,
            CostBasis=0.0,
            Liquidity=spec["liquidity"],
            Risk=spec["risk"],
            Provenance="user_entered",
            LastUpdated=_now(),
        )
        db.add(holding)

    holding.Value = (holding.Value or 0) + body.amount
    holding.CostBasis = (holding.CostBasis or 0) + body.amount
    holding.LastUpdated = _now()

    _debit(account, body.amount)

    tx = models.Transaction(
        EntityId=entity_id,
        AccountId=account.Id,
        Date=_now(),
        Description=f"Invest — {holding.Name}",
        Amount=body.amount,
        Category="Invest / Save",
        Type="outflow",
        Provenance="user_entered",
        Status="completed",
    )
    db.add(tx)
    db.add(models.ActivityEvent(
        EntityId=entity_id, Timestamp=_now(),
        Title="Invested from a recommendation",
        Detail=f"{body.amount:,.0f} KES into {holding.Name}",
        Kind="recommendation",
    ))

    db.commit()
    db.refresh(holding)
    db.refresh(tx)
    return {
        "ok": True,
        "investment": investment_dto(holding),
        "transaction": transaction_dto(tx),
        "accountBalance": account.Balance,
    }


@router.post("/fund-goal")
def fund_goal(
    entity_id: str,
    body: GoalFundRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _own(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})

    account = db.get(models.Account, body.account_id)
    if account is None or account.EntityId != entity_id:
        return JSONResponse(status_code=404, content={"error": "Account not found"})
    goal = db.get(models.Goal, body.goal_id)
    if goal is None or goal.EntityId != entity_id:
        return JSONResponse(status_code=404, content={"error": "Goal not found"})
    if account.Balance < body.amount:
        return JSONResponse(
            status_code=400,
            content={"error": f"Not enough in {account.Name} — balance is {account.Balance:,.2f}"},
        )

    goal.Current += body.amount
    _debit(account, body.amount)

    tx = models.Transaction(
        EntityId=entity_id, AccountId=account.Id, Date=_now(),
        Description=f"Goal contribution — {goal.Name}",
        Amount=body.amount, Category="Invest / Save", Type="outflow",
        Provenance="user_entered", Status="completed",
    )
    db.add(tx)
    db.add(models.ActivityEvent(
        EntityId=entity_id, Timestamp=_now(), Title="Goal funded",
        Detail=f"{body.amount:,.0f} KES toward {goal.Name}", Kind="goal",
    ))

    db.commit()
    db.refresh(goal)
    db.refresh(tx)
    return {
        "ok": True,
        "goal": goal_dto(goal),
        "transaction": transaction_dto(tx),
        "accountBalance": account.Balance,
    }


@router.post("/pay-debt")
def pay_debt(
    entity_id: str,
    body: DebtPaymentRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _own(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})

    account = db.get(models.Account, body.account_id)
    if account is None or account.EntityId != entity_id:
        return JSONResponse(status_code=404, content={"error": "Account not found"})
    liability = db.get(models.Liability, body.liability_id)
    if liability is None or liability.EntityId != entity_id:
        return JSONResponse(status_code=404, content={"error": "Liability not found"})
    if account.Balance < body.amount:
        return JSONResponse(
            status_code=400,
            content={"error": f"Not enough in {account.Name} — balance is {account.Balance:,.2f}"},
        )

    liability.Balance = max(0.0, liability.Balance - body.amount)
    liability.LastUpdated = _now()
    _debit(account, body.amount)

    tx = models.Transaction(
        EntityId=entity_id, AccountId=account.Id, Date=_now(),
        Description=f"Repayment — {liability.Name}",
        Amount=body.amount, Category="Debt repayment", Type="outflow",
        Provenance="user_entered", Status="completed",
    )
    db.add(tx)
    db.add(models.ActivityEvent(
        EntityId=entity_id, Timestamp=_now(), Title="Debt repayment",
        Detail=f"{body.amount:,.0f} KES against {liability.Name}", Kind="recommendation",
    ))

    db.commit()
    db.refresh(liability)
    db.refresh(tx)
    return {
        "ok": True,
        "liability": liability_dto(liability),
        "transaction": transaction_dto(tx),
        "accountBalance": account.Balance,
    }
