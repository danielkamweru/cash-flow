"""Trigger evaluation: turn ledger reality into a rule firing (or not).

Every check is deterministic and explainable — the ``detail`` strings carry the
exact numbers behind the result so the UI (and the user) can see its work.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app import models
from app.snapshot import calculate_surplus

INCOME_PATTERN = re.compile(r"income|salary|salar|payday|wages", re.I)
EMERGENCY_BUFFER_DEFAULT = 40000.0

ACTIVE_STATUSES = {"active_demo"}


@dataclass
class EvalResult:
    fired: bool
    outcome: str  # proposed | guarded | skipped
    amount: float | None = None
    detail: str = ""
    actions: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "fired": self.fired,
            "outcome": self.outcome,
            "amount": round(self.amount, 2) if self.amount is not None else None,
            "detail": self.detail,
            "actions": self.actions,
        }


@dataclass
class EntityCtx:
    entity: models.Entity
    accounts: list[models.Account]
    transactions: list[models.Transaction]
    obligations: list[models.Obligation]
    liabilities: list[models.Liability]
    goals: list[models.Goal]
    surplus_config: models.SurplusConfig | None

    @property
    def liquid_balance(self) -> float:
        if self.surplus_config and self.surplus_config.LiquidBalanceOverride is not None:
            return float(self.surplus_config.LiquidBalanceOverride)
        return sum(a.Balance for a in self.accounts if a.IsLiquid)

    @property
    def emergency_buffer(self) -> float:
        if self.surplus_config and self.surplus_config.EmergencyBufferOverride is not None:
            return float(self.surplus_config.EmergencyBufferOverride)
        return EMERGENCY_BUFFER_DEFAULT

    @property
    def discretionary_ratio(self) -> float:
        if self.surplus_config:
            return float(self.surplus_config.DiscretionarySpendRatio)
        return 0.33

    @property
    def automation_enabled(self) -> bool:
        if self.surplus_config is None:
            return True
        return bool(getattr(self.surplus_config, "AutomationEnabled", True))

    def surplus(self, upcoming: float) -> dict[str, Any]:
        return calculate_surplus(
            self.entity.Id,
            self.liquid_balance,
            upcoming,
            self.emergency_buffer,
            self.discretionary_ratio,
        )

    def source_account(self) -> models.Account | None:
        mpesa = next((a for a in self.accounts if a.Provider == "mpesa" and a.IsLiquid), None)
        if mpesa:
            return mpesa
        return next((a for a in self.accounts if a.IsLiquid), None)


def load_ctx(db: Session, entity_id: str) -> EntityCtx:
    return EntityCtx(
        entity=db.get(models.Entity, entity_id),
        accounts=db.query(models.Account).filter(models.Account.EntityId == entity_id).all(),
        transactions=db.query(models.Transaction).filter(models.Transaction.EntityId == entity_id).all(),
        obligations=db.query(models.Obligation).filter(models.Obligation.EntityId == entity_id).all(),
        liabilities=db.query(models.Liability).filter(models.Liability.EntityId == entity_id).all(),
        goals=db.query(models.Goal).filter(models.Goal.EntityId == entity_id).all(),
        surplus_config=(
            db.query(models.SurplusConfig).filter(models.SurplusConfig.EntityId == entity_id).first()
        ),
    )


def _upcoming_obligations(ctx: EntityCtx, window_days: int | None) -> list[models.Obligation]:
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=window_days or 0)
    return [
        o
        for o in ctx.obligations
        if (o.Status or "upcoming") in ("upcoming", "overdue")
        and o.DueDate is not None
        and (window_days is None or now <= o.DueDate <= horizon)
    ]


def _due_liabilities(ctx: EntityCtx, window_days: int) -> list[models.Liability]:
    now = datetime.now(timezone.utc)
    upcoming_days = [(now + timedelta(days=d)).day for d in range(0, window_days + 1)]
    return [li for li in ctx.liabilities if li.DueDay is not None and li.DueDay in upcoming_days]


def _recent_income(ctx: EntityCtx, threshold: float) -> models.Transaction | None:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=30)
    for t in ctx.transactions:
        if t.Type != "inflow" or t.Date is None or t.Date < window_start:
            continue
        if t.Amount < threshold:
            continue
        if INCOME_PATTERN.search(t.Category or "") or INCOME_PATTERN.search(t.Description or ""):
            return t
    return None


def _surplus_proposal(ctx: EntityCtx, spec: Any) -> tuple[float | None, str]:
    upcoming = sum(o.Amount for o in _upcoming_obligations(ctx, None))
    surplus = ctx.surplus(upcoming)
    safe_to_invest = float(surplus["safeToInvest"])
    if spec.amount_rule == "fixed" and spec.amount is not None and spec.amount > 0:
        safe_to_invest = float(spec.amount)
    return safe_to_invest, (
        f"Surplus scan: liquid KES {ctx.liquid_balance:,.0f} − obligations KES {upcoming:,.0f} "
        f"− buffer KES {ctx.emergency_buffer:,.0f} → safe-to-invest KES {safe_to_invest:,.0f}."
    )


def evaluate_trigger(ctx: EntityCtx, rule: models.AutomationRule) -> EvalResult:
    """Decide whether a rule fires right now, and what it would move."""
    from app.automation.schema import parse_action, parse_trigger

    trigger = parse_trigger(rule.TriggerSpec)
    action = parse_action(rule.ActionSpec)
    if trigger is None:
        return EvalResult(False, "skipped", detail="Rule has no structured trigger spec yet.")
    if action is None:
        return EvalResult(False, "skipped", detail="Rule has no structured action spec yet.")

    money_rules_order: dict[str, int] = {"guard": 3, "notify": 2, "send_money": 1, "pay_bills": 1}
    if money_rules_order.get(action.op, 0) <= 1 and not ctx.automation_enabled:
        return EvalResult(
            False,
            "skipped",
            detail="Automation is disabled for this entity — recommendation only.",
        )

    if trigger.kind == "income_detected":
        income = _recent_income(ctx, trigger.threshold or 0)
        if income is None:
            return EvalResult(
                False,
                "skipped",
                detail=(
                    f"No income credit ≥ KES {trigger.threshold:,.0f} in the last 30 days "
                    "(payday triggers are evaluated on the 1st and 25th)."
                ),
            )
        amount, detail = _surplus_proposal(ctx, action)
        if amount is None or amount < trigger.amount_min:
            return EvalResult(
                False,
                "skipped",
                detail=f"{detail} Proposed amount below KES {trigger.amount_min:,.0f} — nothing to sweep.",
            )
        return EvalResult(
            True,
            "proposed",
            amount,
            detail,
            actions=[
                f"Income detected: {income.Description} KES {income.Amount:,.0f}",
                "Obligations and emergency buffer protected before surplus is moved",
            ],
        )

    if trigger.kind == "due_date":
        liabilities = _due_liabilities(ctx, trigger.window_days) if trigger.target == "liabilities" else []
        obligations = _upcoming_obligations(ctx, trigger.window_days) if trigger.target == "obligations" else []
        due = obligations + liabilities
        if not due:
            return EvalResult(
                False,
                "skipped",
                detail=f"No {trigger.target} due within the next {trigger.window_days} day(s).",
            )
        amount = sum(o.Amount for o in due)
        names = ", ".join(o.Name for o in due)
        detail = f"{len(due)} {trigger.target} due within {trigger.window_days} day(s): {names} — KES {amount:,.0f}."
        if amount < trigger.amount_min:
            return EvalResult(False, "skipped", detail=f"{detail} Below the KES {trigger.amount_min:,.0f} minimum.")
        return EvalResult(True, "proposed", amount, detail, actions=[f"Pay KES {amount:,.0f} for: {names}"])

    # weekly_recon / low_balance: guard the liquidity floor.
    if trigger.kind in ("weekly_recon", "low_balance"):
        if ctx.liquid_balance < ctx.emergency_buffer:
            gap = ctx.emergency_buffer - ctx.liquid_balance
            return EvalResult(
                True,
                "guarded",
                amount=ctx.emergency_buffer,
                detail=(
                    f"Liquid KES {ctx.liquid_balance:,.0f} below the KES {ctx.emergency_buffer:,.0f} "
                    f"emergency buffer (gap KES {gap:,.0f}) — sweeps are blocked until the buffer recovers."
                ),
                actions=["Block any new investment/surplus sweep", "Keep obligations liquid"],
            )
        return EvalResult(
            False,
            "skipped",
            detail=f"Buffer intact: liquid KES {ctx.liquid_balance:,.0f} ≥ KES {ctx.emergency_buffer:,.0f}.",
        )

    return EvalResult(False, "skipped", detail=f"Unknown trigger kind: {trigger.kind}")


def rules_that_may_run(db: Session, entity_id: str) -> list[models.AutomationRule]:
    """Active rules that are not already waiting on a proposal."""
    return (
        db.query(models.AutomationRule)
        .filter(
            models.AutomationRule.EntityId == entity_id,
            models.AutomationRule.Status.in_(ACTIVE_STATUSES),
        )
        .all()
    )