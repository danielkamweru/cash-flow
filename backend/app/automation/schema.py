"""Structured trigger/action specs that the automation engine can reason over.

The human-readable ``Trigger`` / ``Action`` prose on an AutomationRule row stays
put for the UI; the engine evaluates the structured ``TriggerSpec`` and runs
the ``ActionSpec`` below.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError

TriggerKind = Literal["income_detected", "due_date", "weekly_recon", "low_balance"]
ActionOp = Literal["send_money", "pay_bills", "guard", "notify"]
AmountRule = Literal["safe_surplus", "fixed"]


class ActionSpec(BaseModel):
    op: ActionOp
    amount_rule: AmountRule = "safe_surplus"
    amount: float | None = None  # required when amount_rule == "fixed"
    target_goal_id: str | None = None  # overrides the rule TargetGoalId for send_money
    recipient_mobile_no: str | None = None  # required for a live money movement
    purpose: str = "Wealth Loop automation"


class TriggerSpec(BaseModel):
    kind: TriggerKind
    threshold: float | None = None  # income_detected: minimum single income credit
    amount_min: float = 200.0  # ignore proposals smaller than this (KES)
    window_days: int = Field(default=3, ge=1, le=30)  # due_date look-ahead
    target: Literal["obligations", "liabilities"] = "obligations"


def parse_trigger(raw: Any) -> TriggerSpec | None:
    if not isinstance(raw, dict):
        return None
    try:
        return TriggerSpec(**raw)
    except ValidationError:
        return None


def parse_action(raw: Any) -> ActionSpec | None:
    if not isinstance(raw, dict):
        return None
    try:
        return ActionSpec(**raw)
    except ValidationError:
        return None


def next_run_at(spec: TriggerSpec, now) -> Any:
    """Next scheduled check for a trigger kind, as an aware datetime."""
    from datetime import timedelta

    if spec.kind == "income_detected":
        # Paydays in Kenya commonly fall on the 1st or 25th of the month.
        for day in (1, 25):
            candidate = now.replace(day=day, hour=6, minute=0, second=0, microsecond=0)
            if candidate > now:
                return candidate
        month = now.replace(day=1, hour=6, minute=0, second=0, microsecond=0) + timedelta(days=32)
        return month.replace(day=1)
    if spec.kind == "weekly_recon":
        days_until_monday = (0 - now.weekday()) % 7 or 7
        candidate = (now + timedelta(days=days_until_monday)).replace(
            hour=7, minute=0, second=0, microsecond=0
        )
        return candidate
    # due_date and low_balance run daily
    return (now + timedelta(days=1)).replace(hour=5, minute=0, second=0, microsecond=0)