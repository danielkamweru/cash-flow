"""Automation engine endpoints: evaluate, approve, decline, re-arm, runs."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user, require_pin
from app.automation import approve, decline, enable, evaluate_trigger, load_ctx, propose_or_run
from app.automation.evaluate import rules_that_may_run
from app.db import get_db
from app.mappers import rule_run_dto

router = APIRouter(prefix="/api")

LIVE_ACTION_OPS = {"send_money", "pay_bills"}


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ApproveRequest(CamelModel):
    pin: str | None = None
    live: bool = False


class EnableRequest(CamelModel):
    auto_approve: bool | None = None


def _rule_or_404(db: Session, rule_id: str, user: models.User) -> models.AutomationRule:
    rule = db.get(models.AutomationRule, rule_id)
    if rule is None:
        raise JSONResponseVoid  # replaced below
    return rule


def _owned_rule(db: Session, rule_id: str, user: models.User) -> models.AutomationRule | None:
    rule = db.get(models.AutomationRule, rule_id)
    if rule is None or rule.EntityId is None:
        return None
    entity = db.get(models.Entity, rule.EntityId)
    if entity is None or entity.UserId != user.Id:
        return None
    return rule


def _not_found() -> JSONResponse:
    return JSONResponse(status_code=404, content={"error": "Rule not found"})


def _runs_for(db: Session, rule_id: str, limit: int = 20) -> list[dict[str, Any]]:
    runs = (
        db.query(models.RuleRun)
        .filter(models.RuleRun.RuleId == rule_id)
        .order_by(models.RuleRun.TriggeredAt.desc())
        .limit(limit)
        .all()
    )
    return [rule_run_dto(r) for r in runs]


@router.get("/entities/{entity_id}/automation/runs")
def list_runs(
    entity_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entity = db.get(models.Entity, entity_id)
    if entity is None or entity.UserId != user.Id:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    runs = (
        db.query(models.RuleRun)
        .filter(models.RuleRun.EntityId == entity_id)
        .order_by(models.RuleRun.TriggeredAt.desc())
        .limit(50)
        .all()
    )
    return [rule_run_dto(r) for r in runs]


@router.post("/entities/{entity_id}/automation/evaluate")
def evaluate_entity(
    entity_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run every active rule for an entity right now (dry-run, nothing persists)."""
    entity = db.get(models.Entity, entity_id)
    if entity is None or entity.UserId != user.Id:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    ctx = load_ctx(db, entity_id)
    results = []
    for rule in rules_that_may_run(db, entity_id):
        rule_trigger = evaluate_trigger(ctx, rule)
        results.append(
            {
                "ruleId": rule.Id,
                "ruleName": rule.Name,
                "status": rule.Status,
                "autoApprove": rule.AutoApprove,
                "evaluation": rule_trigger.as_dict(),
            }
        )
    return {"results": results}


@router.post("/automation/rules/{rule_id}/evaluate")
def evaluate_rule(
    rule_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rule = _owned_rule(db, rule_id, user)
    if rule is None:
        return _not_found()
    ctx = load_ctx(db, rule.EntityId)
    result = evaluate_trigger(ctx, rule)
    return {
        "ruleId": rule.Id,
        "ruleName": rule.Name,
        "status": rule.Status,
        "autoApprove": rule.AutoApprove,
        "evaluation": result.as_dict(),
        "runs": _runs_for(db, rule.Id),
    }


@router.post("/automation/rules/{rule_id}/approve")
def approve_rule(
    rule_id: str,
    req: ApproveRequest | None = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rule = _owned_rule(db, rule_id, user)
    if rule is None:
        return _not_found()
    payload = req or ApproveRequest()
    mode = "live" if payload.live else "simulated"
    if mode == "live":
        require_pin(user, payload.pin)
    run = approve(db, rule, mode=mode)
    if run is None:
        return JSONResponse(
            status_code=409,
            content={"error": "Rule is not awaiting authorization — nothing to approve.", "ruleId": rule.Id},
        )
    return {"ruleId": rule.Id, "ruleName": rule.Name, "run": rule_run_dto(run), "runs": _runs_for(db, rule.Id)}


@router.post("/automation/rules/{rule_id}/decline")
def decline_rule(
    rule_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rule = _owned_rule(db, rule_id, user)
    if rule is None:
        return _not_found()
    run = decline(db, rule)
    if run is None:
        return JSONResponse(
            status_code=409,
            content={"error": "Rule is not awaiting authorization — nothing to decline.", "ruleId": rule.Id},
        )
    return {"ruleId": rule.Id, "ruleName": rule.Name, "run": rule_run_dto(run), "runs": _runs_for(db, rule.Id)}


@router.post("/automation/rules/{rule_id}/enable")
def enable_rule(
    rule_id: str,
    req: EnableRequest | None = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rule = _owned_rule(db, rule_id, user)
    if rule is None:
        return _not_found()
    payload = req or EnableRequest()
    rule = enable(db, rule, auto_approve=payload.auto_approve)
    return {
        "id": rule.Id,
        "name": rule.Name,
        "status": rule.Status,
        "autoApprove": rule.AutoApprove,
        "runs": _runs_for(db, rule.Id),
    }


@router.patch("/automation/rules/{rule_id}")
def patch_rule(
    rule_id: str,
    req: EnableRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rule = _owned_rule(db, rule_id, user)
    if rule is None:
        return _not_found()
    if req.auto_approve is not None and rule.Status in ("active_demo", "awaiting_authorization", "declined"):
        rule.AutoApprove = req.auto_approve
        db.commit()
        db.refresh(rule)
    return {
        "id": rule.Id,
        "status": rule.Status,
        "autoApprove": rule.AutoApprove,
    }