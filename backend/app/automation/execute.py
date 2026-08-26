"""Rule lifecycle: proposal, approval gate, and (simulated or live) execution.

Money never moves silently: a rule that fires either lands as a proposal the
user can approve/decline, or (when ``AutoApprove`` is on and the entity has
automation enabled) executes immediately. Live execution reuses the LOOP
gateway and is PIN-gated by the router; everything else posts to the ledger
with ``demo`` provenance so the flow is visible without moving real money.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app import models
from app.automation.evaluate import (
    EvalResult,
    _upcoming_obligations,
    load_ctx,
)
from app.automation.schema import next_run_at, parse_action, parse_trigger
from app.loop import SEND_MONEY_MPESA, get_gateway
from app.loop.completion import (
    record_completed_payment,
    record_completed_send_money,
)

STATUS_PROPOSED = "awaiting_authorization"
STATUS_DECLINED = "declined"
STATUS_ACTIVE = "active_demo"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _schedule_next(db: Session, rule: models.AutomationRule) -> None:
    trigger = parse_trigger(rule.TriggerSpec)
    if trigger is not None:
        rule.NextRunAt = next_run_at(trigger, _now())


def _log(db: Session, rule: models.AutomationRule, title: str, detail: str, kind: str = "system") -> None:
    db.add(
        models.ActivityEvent(
            EntityId=rule.EntityId,
            Timestamp=_now(),
            Title=title,
            Detail=detail,
            Kind=kind,
        )
    )


def propose_or_run(
    db: Session,
    rule: models.AutomationRule,
    eval_result: EvalResult,
    *,
    mode: str = "simulated",
) -> models.RuleRun:
    """Persist an evaluation. Money-moving rules respect the approval gate."""
    now = _now()
    action = parse_action(rule.ActionSpec)

    if eval_result.outcome == "guarded":
        run = models.RuleRun(
            RuleId=rule.Id,
            EntityId=rule.EntityId,
            TriggeredAt=now,
            Outcome="guarded",
            RunMode="dry_run" if mode == "dry_run" else mode,
            Detail=eval_result.detail,
        )
        db.add(run)
        rule.LastRunAt = now
        _schedule_next(db, rule)
        _log(db, rule, f"Guard tripped: {rule.Name}", eval_result.detail, kind="analysis")
        db.commit()
        db.refresh(run)
        return run

    if not eval_result.fired:
        return None  # nothing to record — skipped evaluations stay quiet

    if action is not None and action.op in ("guard", "notify"):
        run = models.RuleRun(
            RuleId=rule.Id,
            EntityId=rule.EntityId,
            TriggeredAt=now,
            Outcome="guarded" if action.op == "guard" else "skipped",
            RunMode="dry_run" if mode == "dry_run" else mode,
            ProposedAmount=eval_result.amount,
            Detail=eval_result.detail,
        )
        db.add(run)
        rule.LastRunAt = now
        _schedule_next(db, rule)
        _log(db, rule, f"Protection rule: {rule.Name}", eval_result.detail, kind="analysis")
        db.commit()
        db.refresh(run)
        return run

    # Money rule: proposal or auto-execute.
    amount = eval_result.amount or 0.0
    if rule.AutoApprove:
        run = models.RuleRun(
            RuleId=rule.Id,
            EntityId=rule.EntityId,
            TriggeredAt=now,
            Outcome="executed",
            RunMode=mode,
            ProposedAmount=amount,
            Detail=eval_result.detail,
        )
        db.add(run)
        db.flush()
        return _execute(db, rule, run, mode=mode)

    run = models.RuleRun(
        RuleId=rule.Id,
        EntityId=rule.EntityId,
        TriggeredAt=now,
        Outcome="proposed",
        RunMode=mode,
        ProposedAmount=amount,
        Detail=eval_result.detail,
    )
    db.add(run)
    rule.Status = STATUS_PROPOSED
    rule.LastRunAt = now
    _schedule_next(db, rule)
    _log(
        db,
        rule,
        f"Action proposed: {rule.Name}",
        f"KES {amount:,.0f} — {eval_result.detail}",
        kind="automation",
    )
    db.commit()
    db.refresh(run)
    return run


def approve(
    db: Session,
    rule: models.AutomationRule,
    *,
    mode: str = "simulated",
) -> models.RuleRun:
    """Approve the latest pending proposal and execute it."""
    now = _now()
    latest = (
        db.query(models.RuleRun)
        .filter(models.RuleRun.RuleId == rule.Id)
        .order_by(models.RuleRun.TriggeredAt.desc())
        .first()
    )
    if rule.Status != STATUS_PROPOSED:
        return latest

    rule.AuthorizedAt = rule.AuthorizedAt or now
    if latest is not None and latest.Outcome == "proposed":
        latest.Outcome = "approved"
        latest.RunMode = mode
        db.flush()
    return _execute(db, rule, latest, mode=mode)


def decline(db: Session, rule: models.AutomationRule) -> models.RuleRun | None:
    now = _now()
    if rule.Status != STATUS_PROPOSED:
        return None
    latest = (
        db.query(models.RuleRun)
        .filter(models.RuleRun.RuleId == rule.Id)
        .order_by(models.RuleRun.TriggeredAt.desc())
        .first()
    )
    if latest is not None and latest.Outcome == "proposed":
        latest.Outcome = "declined"
    rule.Status = STATUS_DECLINED
    rule.LastRunAt = now
    _schedule_next(db, rule)
    _log(db, rule, f"Action declined: {rule.Name}", "No money moved. The rule is paused until you re-enable it.")
    db.commit()
    return latest


def enable(db: Session, rule: models.AutomationRule, *, auto_approve: bool | None = None) -> models.AutomationRule:
    if auto_approve is not None:
        rule.AutoApprove = bool(auto_approve)
    rule.Status = STATUS_ACTIVE
    _log(db, rule, f"Rule re-armed: {rule.Name}", "Back on the evaluation schedule — trigger checks resumed.")
    db.commit()
    db.refresh(rule)
    return rule


def _execute(
    db: Session,
    rule: models.AutomationRule,
    run: models.RuleRun | None,
    *,
    mode: str = "simulated",
) -> models.RuleRun:
    """Run the rule's action against the ledger (and the LOOP gateway when live)."""
    now = _now()
    action = parse_action(rule.ActionSpec)
    trigger = parse_trigger(rule.TriggerSpec)
    ctx = load_ctx(db, rule.EntityId)
    account = ctx.source_account()
    if account is None:
        return _fail(db, rule, run, "No liquid source account on this entity.")

    live = mode == "live"
    txn_reference: str | None = None
    amount = run.ProposedAmount if run is not None and run.ProposedAmount else (action.amount if action else 0.0)
    provenance = "actual" if live else "demo"

    try:
        if action is None:
            raise ValueError("Rule has no structured action spec.")

        if action.op == "send_money":
            goal_id = action.target_goal_id or rule.TargetGoalId
            recipient = action.recipient_mobile_no or "254700000000"
            purpose = action.purpose or "Wealth Loop automation"
            if live:
                result = get_gateway().send(
                    SEND_MONEY_MPESA,
                    {
                        "recipientMobileNo": recipient,
                        "amount": f"{amount:g}",
                        "purposeOfPayment": purpose,
                    },
                )
                if not result.get("txnReference"):
                    raise ValueError(f"LOOP gateway did not return a reference: {result}")
                txn_reference = result["txnReference"]
            else:
                txn_reference = f"SIM-AUT-{uuid.uuid4().hex[:12].upper()}"
            record_completed_send_money(
                db,
                entity_id=rule.EntityId,
                account_id=account.Id,
                amount=amount,
                txn_reference=txn_reference,
                description=f"{rule.Name} — automated send ({'simulated' if not live else 'live'})",
                goal_id=goal_id,
                automation_rule_id=rule.Id,
                provenance=provenance,
            )

        elif action.op == "pay_bills":
            if trigger is None:
                raise ValueError("pay_bills rules need a due_date trigger spec.")
            obligations = _upcoming_obligations(ctx, trigger.window_days)
            if not obligations:
                return _fail(db, rule, run, "No obligations are due right now — nothing to pay.")
            total = 0.0
            for obligation in obligations:
                if live:
                    result = get_gateway().send(
                        SEND_MONEY_MPESA,
                        {
                            "recipientMobileNo": action.recipient_mobile_no or "254700000000",
                            "amount": f"{obligation.Amount:g}",
                            "purposeOfPayment": f"{rule.Name}: {obligation.Name}",
                        },
                    )
                    if not result.get("txnReference"):
                        raise ValueError(f"LOOP gateway did not return a reference: {result}")
                    ref = result["txnReference"]
                else:
                    ref = f"SIM-AUT-{uuid.uuid4().hex[:12].upper()}"
                record_completed_payment(
                    db,
                    entity_id=rule.EntityId,
                    account_id=account.Id,
                    amount=obligation.Amount,
                    txn_reference=ref,
                    description=f"{rule.Name} — {obligation.Name} ({'simulated' if not live else 'live'})",
                    category="Bill payment",
                    obligation_id=obligation.Id,
                    provenance=provenance,
                )
                total += obligation.Amount
            txn_reference = f"SIM-AUT-{uuid.uuid4().hex[:12].upper()}" if not live else None
            amount = total

        else:
            # guard / notify — nothing to execute, the run was already recorded.
            rule.ExecutedAt = now
            rule.LastRunAt = now
            _schedule_next(db, rule)
            db.commit()
            return run

        rule.ExecutedAt = now
        rule.LastRunAt = now
        rule.Status = STATUS_ACTIVE
        _schedule_next(db, rule)
        if run is not None:
            run.Outcome = "executed"
            run.RunMode = mode
            run.ProposedAmount = amount
            run.TxnReference = txn_reference
        _log(
            db,
            rule,
            f"Executed: {rule.Name}",
            f"KES {amount:,.0f} routed via {account.Name}"
            + (f" · ref {txn_reference}" if txn_reference else ""),
            kind="automation",
        )
        db.commit()
        if run is not None:
            db.refresh(run)
        return run
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return _fail(db, rule, run, str(exc))


def _fail(
    db: Session,
    rule: models.AutomationRule,
    run: models.RuleRun | None,
    message: str,
) -> models.RuleRun:
    now = _now()
    if run is None:
        run = models.RuleRun(
            RuleId=rule.Id,
            EntityId=rule.EntityId,
            TriggeredAt=now,
            Outcome="failed",
            Error=message,
        )
        db.add(run)
    else:
        run.Outcome = "failed"
        run.Error = message
    rule.LastRunAt = now
    _log(db, rule, f"Automation failed: {rule.Name}", message, kind="system")
    db.commit()
    db.refresh(run)
    return run