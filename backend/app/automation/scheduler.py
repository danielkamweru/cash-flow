"""Scheduled trigger checks.

Runs in the FastAPI process via APScheduler. Each job opens its own session so
a slow or failing rule never blocks another. On startup ``catch_up`` runs every
active rule once so the demo shows real proposals without waiting for a
schedule slot.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app import models
from app.automation.execute import propose_or_run
from app.automation.evaluate import evaluate_trigger, load_ctx, rules_that_may_run
from app.automation.schema import parse_trigger
from app.db import SessionLocal

logger = logging.getLogger("cash-flow.automation")

scheduler: BackgroundScheduler | None = None


def run_all_active(db: Session, *, kind: str | None = None) -> int:
    """Evaluate every active rule, optionally filtered by trigger kind."""
    entities = db.query(models.Entity).all()
    ran = 0
    for entity in entities:
        for rule in rules_that_may_run(db, entity.Id):
            trigger = parse_trigger(rule.TriggerSpec)
            if kind is not None and (trigger is None or trigger.kind != kind):
                continue
            try:
                ctx = load_ctx(db, rule.EntityId)
                result = evaluate_trigger(ctx, rule)
                if result.fired:
                    propose_or_run(db, rule, result, mode="simulated")
                    ran += 1
            except Exception as exc:  # noqa: BLE001
                logger.error("Automation rule %s failed: %s", rule.Id, exc)
                db.rollback()
    return ran


def _job_daily() -> None:
    db = SessionLocal()
    try:
        run_all_active(db, kind="due_date")
        run_all_active(db, kind="low_balance")
    except Exception as exc:  # noqa: BLE001
        logger.error("Daily automation job failed: %s", exc)
        db.rollback()
    finally:
        db.close()


def _job_payday() -> None:
    db = SessionLocal()
    try:
        run_all_active(db, kind="income_detected")
    except Exception as exc:  # noqa: BLE001
        logger.error("Payday automation job failed: %s", exc)
        db.rollback()
    finally:
        db.close()


def _job_weekly() -> None:
    db = SessionLocal()
    try:
        run_all_active(db, kind="weekly_recon")
    except Exception as exc:  # noqa: BLE001
        logger.error("Weekly automation job failed: %s", exc)
        db.rollback()
    finally:
        db.close()


def catch_up() -> int:
    """Evaluate every active rule once at startup, simulating the schedule."""
    db = SessionLocal()
    try:
        return run_all_active(db)
    finally:
        db.close()


def start_scheduler() -> None:
    global scheduler
    if scheduler is not None and scheduler.running:
        return
    scheduler = BackgroundScheduler(timezone=timezone.utc)
    scheduler.add_job(_job_daily, "cron", hour=5, minute=0, id="automation.daily")
    scheduler.add_job(_job_payday, "cron", day="1,25", hour=6, minute=0, id="automation.payday")
    scheduler.add_job(_job_weekly, "cron", day_of_week="mon", hour=7, minute=0, id="automation.weekly")
    scheduler.start()
    logger.info("Automation scheduler started")


def stop_scheduler() -> None:
    global scheduler
    if scheduler is not None:
        scheduler.shutdown(wait=False)
        scheduler = None