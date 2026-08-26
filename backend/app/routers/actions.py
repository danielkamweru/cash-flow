"""Execute an advisor recommendation.

The Advisor page proposes concrete moves — put KES 12,000 a month into a money
market fund, add KES 5,000 toward a goal, clear a liability. This turns any of
those into real records: money leaves the funding account, the destination
(investment, goal, or liability) is updated, and a transaction is written so the
ledger explains where it went.

Where the destination is reachable over LOOP, the money is moved for real
through the gateway first and only recorded once it succeeds. Send-money
channels that require a PIN still require it here.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import Field
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user, require_pin
from app.db import get_db
from app.loop import (
    PAY_TO_PAYBILL,
    SEND_MONEY_MPESA,
    SEND_MONEY_PESALINK,
    get_gateway,
)
from app.loop.completion import is_success
from app.mappers import goal_dto, investment_dto, liability_dto, transaction_dto
from app.schemas import CamelModel

router = APIRouter(prefix="/api/entities/{entity_id}/actions")

# Instruments the advisor can allocate to, and how a holding of each behaves.
INSTRUMENT_DEFAULTS = {
    "mmf":        {"liquidity": "daily",    "risk": "low",      "label": "Money Market Fund"},
    "sacco":      {"liquidity": "locked",   "risk": "moderate", "label": "SACCO deposits"},
    "tbill":      {"liquidity": "maturity", "risk": "low",      "label": "Treasury Bill"},
    "tbond":      {"liquidity": "tplus2",   "risk": "moderate", "label": "Treasury Bond"},
    "infra_bond": {"liquidity": "maturity", "risk": "moderate", "label": "Infrastructure Bond"},
    "nse":        {"liquidity": "tplus2",   "risk": "elevated", "label": "NSE equities"},
}

# LOOP channels a payout can leave through.
CHANNELS = {
    "mpesa":    (SEND_MONEY_MPESA, True),
    "pesalink": (SEND_MONEY_PESALINK, True),
    "paybill":  (PAY_TO_PAYBILL, False),
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _own(db: Session, entity_id: str, user: models.User) -> models.Entity | None:
    entity = db.get(models.Entity, entity_id)
    if entity is None or entity.UserId != user.Id:
        return None
    return entity


class InvestRequest(CamelModel):
    """Move money from an account into an investment holding."""

    account_id: str
    amount: float = Field(gt=0)
    instrument: str = "mmf"
    # Add to an existing holding, or name a new one.
    investment_id: str | None = None
    name: str | None = None
    # Optional: actually move the money over LOOP to the provider.
    channel: str | None = None          # mpesa | pesalink | paybill
    destination: str | None = None      # phone number, or paybill number
    account_number: str | None = None   # paybill account reference
    pin: str | None = None


class GoalFundRequest(CamelModel):
    account_id: str
    goal_id: str
    amount: float = Field(gt=0)
    channel: str | None = None
    destination: str | None = None
    pin: str | None = None


class DebtPaymentRequest(CamelModel):
    account_id: str
    liability_id: str
    amount: float = Field(gt=0)
    channel: str | None = None
    destination: str | None = None
    account_number: str | None = None
    pin: str | None = None


def _move_over_loop(
    *,
    user: models.User,
    channel: str,
    destination: str,
    amount: float,
    reference: str,
    account_number: str | None,
    pin: str | None,
) -> tuple[bool, dict]:
    """Push the money through LOOP. Returns (succeeded, gateway result)."""
    product_entry = CHANNELS.get(channel)
    if product_entry is None:
        return False, {"message": f"Unsupported channel '{channel}'"}
    product, needs_pin = product_entry

    if needs_pin:
        require_pin(user, pin)

    if channel == "paybill":
        params = {
            "merchantRcvTill": destination,
            "accountNumber": account_number or destination,
            "amount": f"{amount:.2f}",
        }
    else:
        params = {
            "recipientMobileNo": destination,
            "amount": f"{amount:.2f}",
            "purposeOfPayment": reference,
        }

    result = get_gateway().send(product, params)
    return is_success(result), result


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
    """Act on an allocation recommendation: fund an investment holding."""
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

    txn_reference = None
    gateway_result = None
    if body.channel and body.destination:
        moved, gateway_result = _move_over_loop(
            user=user,
            channel=body.channel,
            destination=body.destination,
            amount=body.amount,
            reference=f"Invest — {spec['label']}",
            account_number=body.account_number,
            pin=body.pin,
        )
        if not moved:
            return JSONResponse(
                status_code=502,
                content={"error": "LOOP did not accept the transfer",
                         "loop": {"statusCode": gateway_result.get("statusCode"),
                                  "message": gateway_result.get("message")}},
            )
        txn_reference = gateway_result.get("txnReference")

    if holding is None:
        holding = models.Investment(
            EntityId=entity_id,
            Name=body.name or spec["label"],
            Type=body.instrument,
            Value=0.0,
            CostBasis=0.0,
            Liquidity=spec["liquidity"],
            Risk=spec["risk"],
            Provenance="actual" if txn_reference else "user_entered",
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
        Provenance="actual" if txn_reference else "user_entered",
        LoopTxnReference=txn_reference,
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
        "loop": {"txnReference": txn_reference} if txn_reference else None,
    }


@router.post("/fund-goal")
def fund_goal(
    entity_id: str,
    body: GoalFundRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Act on a goal recommendation: move money into a goal pot."""
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

    txn_reference = None
    if body.channel and body.destination:
        moved, result = _move_over_loop(
            user=user, channel=body.channel, destination=body.destination,
            amount=body.amount, reference=f"Goal — {goal.Name}",
            account_number=None, pin=body.pin,
        )
        if not moved:
            return JSONResponse(status_code=502, content={
                "error": "LOOP did not accept the transfer",
                "loop": {"statusCode": result.get("statusCode"), "message": result.get("message")}})
        txn_reference = result.get("txnReference")

    goal.Current += body.amount
    _debit(account, body.amount)

    tx = models.Transaction(
        EntityId=entity_id, AccountId=account.Id, Date=_now(),
        Description=f"Goal contribution — {goal.Name}",
        Amount=body.amount, Category="Invest / Save", Type="outflow",
        Provenance="actual" if txn_reference else "user_entered",
        LoopTxnReference=txn_reference, Status="completed",
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
        "loop": {"txnReference": txn_reference} if txn_reference else None,
    }


@router.post("/pay-debt")
def pay_debt(
    entity_id: str,
    body: DebtPaymentRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Act on a debt recommendation: pay down a liability."""
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

    txn_reference = None
    if body.channel and body.destination:
        moved, result = _move_over_loop(
            user=user, channel=body.channel, destination=body.destination,
            amount=body.amount, reference=f"Repay — {liability.Name}",
            account_number=body.account_number, pin=body.pin,
        )
        if not moved:
            return JSONResponse(status_code=502, content={
                "error": "LOOP did not accept the payment",
                "loop": {"statusCode": result.get("statusCode"), "message": result.get("message")}})
        txn_reference = result.get("txnReference")

    liability.Balance = max(0.0, liability.Balance - body.amount)
    liability.LastUpdated = _now()
    _debit(account, body.amount)

    tx = models.Transaction(
        EntityId=entity_id, AccountId=account.Id, Date=_now(),
        Description=f"Repayment — {liability.Name}",
        Amount=body.amount, Category="Debt repayment", Type="outflow",
        Provenance="actual" if txn_reference else "user_entered",
        LoopTxnReference=txn_reference, Status="completed",
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
        "loop": {"txnReference": txn_reference} if txn_reference else None,
    }
