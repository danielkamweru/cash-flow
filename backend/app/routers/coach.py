from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.business.personal import build_personal_coach_home, get_automation_enabled, set_automation_enabled
from app.db import get_db
from app import models

router = APIRouter(prefix="/api/coach", tags=["coach"])


class AutomationToggleBody(BaseModel):
    enabled: bool = Field(..., description="When true, surplus investing runs autonomously")


@router.get("/personal/home")
def personal_home(db: Session = Depends(get_db)):
    personal = (
        db.query(models.Entity).filter(models.Entity.Type == "PERSONAL").first()
    )
    if personal is None:
        return JSONResponse(status_code=404, content={"error": "No personal entity found"})
    return build_personal_coach_home(personal.Id, db, datetime.now(timezone.utc))


@router.get("/personal/automation")
def get_personal_automation(db: Session = Depends(get_db)):
    personal = db.query(models.Entity).filter(models.Entity.Type == "PERSONAL").first()
    if personal is None:
        return JSONResponse(status_code=404, content={"error": "No personal entity found"})
    enabled = get_automation_enabled(personal.Id, db)
    rules = (
        db.query(models.AutomationRule)
        .filter(models.AutomationRule.EntityId == personal.Id)
        .all()
    )
    return {
        "enabled": enabled,
        "mode": "autonomous" if enabled else "recommend_only",
        "label": (
            "Autonomous surplus investing"
            if enabled
            else "Recommendations only (Market Intelligence)"
        ),
        "rules": [
            {
                "id": r.Id,
                "name": r.Name,
                "description": r.Description,
                "status": r.Status,
                "trigger": r.Trigger,
                "action": r.Action,
            }
            for r in rules
        ],
    }


@router.patch("/personal/automation")
def patch_personal_automation(body: AutomationToggleBody, db: Session = Depends(get_db)):
    personal = db.query(models.Entity).filter(models.Entity.Type == "PERSONAL").first()
    if personal is None:
        return JSONResponse(status_code=404, content={"error": "No personal entity found"})
    result = set_automation_enabled(personal.Id, body.enabled, db)
    coach = build_personal_coach_home(personal.Id, db, datetime.now(timezone.utc))
    return {"success": True, "automation": result, "coach": coach}


@router.get("/entities/{entity_id}/bills")
def entity_bills(entity_id: str, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    entity = db.get(models.Entity, entity_id)
    if entity is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})

    obligations = (
        db.query(models.Obligation)
        .filter(models.Obligation.EntityId == entity_id)
        .order_by(models.Obligation.DueDate)
        .all()
    )
    items = []
    for o in obligations:
        days = max((o.DueDate.replace(tzinfo=timezone.utc) - now).days, 0)
        items.append(
            {
                "id": o.Id,
                "name": o.Name,
                "amount": o.Amount,
                "dueDate": o.DueDate.isoformat().replace("+00:00", "Z"),
                "category": o.Category,
                "status": o.Status,
                "daysUntilDue": days,
                "plainWarning": (
                    f"{o.Name} is due in {days} days — make sure you have the money."
                    if days <= 7
                    else None
                ),
            }
        )
    return {"success": True, "data": items}


@router.get("/entities/{entity_id}/envelopes")
def entity_envelopes(entity_id: str, db: Session = Depends(get_db)):
    from app.business.personal import _envelopes

    return {"success": True, "data": _envelopes(entity_id, db, datetime.now(timezone.utc))}
