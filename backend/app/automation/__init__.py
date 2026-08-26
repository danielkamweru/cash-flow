"""Wealth Loop automation engine.

Deterministic trigger evaluation over an entity's books, an approval gate for
money movement, and scheduled checks that run in the FastAPI process. Rules are
seeded in ``AutomationRules`` with structured ``TriggerSpec``/``ActionSpec``
JSON the engine can reason over (the prose columns stay for humans).
"""

from app.automation.execute import approve, decline, enable, propose_or_run
from app.automation.evaluate import evaluate_trigger, load_ctx, rules_that_may_run
from app.automation.schema import next_run_at, parse_action, parse_trigger

__all__ = [
    "approve",
    "decline",
    "enable",
    "evaluate_trigger",
    "load_ctx",
    "next_run_at",
    "parse_action",
    "parse_trigger",
    "propose_or_run",
    "rules_that_may_run",
]