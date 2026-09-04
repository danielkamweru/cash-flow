from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app import models
from app.advisors import run_advisors
from app.advisors.engine import AdvisorContext
from app.auth import get_current_user
from app.db import get_db
from app.exports import build_pdf, build_xlsx
from app.mappers import (
    account_dto,
    entity_dto,
    goal_dto,
    market_instrument_dto,
    provider_dto,
    transaction_dto,
)
from app.snapshot import EntityBundle, build_snapshot

router = APIRouter(prefix="/api")

NET_WORTH_TYPES = ("PERSONAL", "BUSINESS")


def load_bundle(db: Session, entity_id: str) -> EntityBundle | None:
    entity = db.get(models.Entity, entity_id)
    if entity is None:
        return None
    suppliers = db.query(models.Supplier).filter(models.Supplier.EntityId == entity_id).all()
    return EntityBundle(
        entity=entity,
        accounts=db.query(models.Account).filter(models.Account.EntityId == entity_id).order_by(models.Account.Name).all(),
        transactions=db.query(models.Transaction).filter(models.Transaction.EntityId == entity_id).order_by(models.Transaction.Date.desc()).all(),
        assets=db.query(models.Asset).filter(models.Asset.EntityId == entity_id).all(),
        investments=db.query(models.Investment).filter(models.Investment.EntityId == entity_id).all(),
        liabilities=db.query(models.Liability).filter(models.Liability.EntityId == entity_id).all(),
        obligations=db.query(models.Obligation).filter(models.Obligation.EntityId == entity_id).all(),
        goals=db.query(models.Goal).filter(models.Goal.EntityId == entity_id).order_by(models.Goal.Priority).all(),
        risk_profile=db.query(models.RiskProfile).filter(models.RiskProfile.EntityId == entity_id).first(),
        credit_readiness=db.query(models.CreditReadiness).filter(models.CreditReadiness.EntityId == entity_id).first(),
        automation_rules=db.query(models.AutomationRule).filter(models.AutomationRule.EntityId == entity_id).all(),
        rule_runs=(
            db.query(models.RuleRun)
            .filter(models.RuleRun.EntityId == entity_id)
            .order_by(models.RuleRun.TriggeredAt.desc())
            .limit(30)
            .all()
        ),
        activity_events=db.query(models.ActivityEvent).filter(models.ActivityEvent.EntityId == entity_id).order_by(models.ActivityEvent.Timestamp.desc()).all(),
        cashflow_months=db.query(models.CashflowMonth).filter(models.CashflowMonth.EntityId == entity_id).order_by(models.CashflowMonth.SortOrder).all(),
        surplus_config=db.query(models.SurplusConfig).filter(models.SurplusConfig.EntityId == entity_id).first(),
        suppliers=suppliers,
        bnpl_agreements=(
            db.query(models.BnplAgreement)
            .filter(models.BnplAgreement.SupplierId.in_([s.Id for s in suppliers]))
            .all()
            if suppliers
            else []
        ),
        members=[
            (m, db.get(models.User, m.UserId))
            for m in db.query(models.ProfileMember).filter(models.ProfileMember.EntityId == entity_id).all()
        ],
        business_details=(
            db.query(models.BusinessProfileDetails)
            .filter(models.BusinessProfileDetails.EntityId == entity_id)
            .first()
        ),
    )


def net_worth_for(db: Session, entity_id: str) -> float:
    accounts = db.query(models.Account).filter(models.Account.EntityId == entity_id).all()
    investments = db.query(models.Investment).filter(models.Investment.EntityId == entity_id).all()
    assets = db.query(models.Asset).filter(models.Asset.EntityId == entity_id).all()
    liabilities = db.query(models.Liability).filter(models.Liability.EntityId == entity_id).all()
    return (
        sum(a.Balance for a in accounts)
        + sum(i.Value for i in investments)
        + sum(a.Value for a in assets)
        - sum(l.Balance for l in liabilities)
    )


def consolidated_net_worth(db: Session, user_id: str) -> float:
    entity_ids = [
        e.Id
        for e in db.query(models.Entity)
        .filter(models.Entity.UserId == user_id, models.Entity.Type.in_(NET_WORTH_TYPES))
        .all()
    ]
    return sum(net_worth_for(db, eid) for eid in entity_ids)


def owned_entity(db: Session, entity_id: str, user: models.User) -> models.Entity | None:
    """Look up an entity, but only if it belongs to the signed-in user."""
    entity = db.get(models.Entity, entity_id)
    if entity is None or entity.UserId != user.Id:
        return None
    return entity


@router.get("/health")
def health():
    return {
        "ok": True,
        "service": "cash-flow-api",
        "mode": "demo",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


@router.get("/user")
def get_user(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entities = (
        db.query(models.Entity).filter(models.Entity.UserId == user.Id).order_by(models.Entity.Type).all()
    )
    return {
        "id": user.Id,
        "name": user.Name,
        "email": user.Email,
        "phone": user.Phone,
        "location": user.Location,
        "hasPin": bool(user.PinHash),
        "createdAt": user.CreatedAt.isoformat().replace("+00:00", "Z") if user.CreatedAt.tzinfo else user.CreatedAt.isoformat() + "Z",
        "updatedAt": user.UpdatedAt.isoformat().replace("+00:00", "Z") if user.UpdatedAt.tzinfo else user.UpdatedAt.isoformat() + "Z",
        "entities": [entity_dto(e) for e in entities],
    }


@router.get("/entities")
def get_entities(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entities = (
        db.query(models.Entity)
        .filter(models.Entity.UserId == user.Id)
        .order_by(models.Entity.Type)
        .all()
    )
    return [entity_dto(e) for e in entities]


@router.get("/entities/by-type/{entity_type}/snapshot")
def get_snapshot_by_type(
    entity_type: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    normalized = entity_type.upper()
    if normalized not in ("PERSONAL", "BUSINESS", "CHAMA"):
        return JSONResponse(status_code=400, content={"error": "Invalid entity type"})
    entity = (
        db.query(models.Entity)
        .filter(models.Entity.UserId == user.Id, models.Entity.Type == normalized)
        .order_by(models.Entity.CreatedAt)
        .first()
    )
    if entity is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    bundle = load_bundle(db, entity.Id)
    if bundle is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    markets = db.query(models.MarketInstrument).all()
    return build_snapshot(bundle, markets, consolidated_net_worth(db, user.Id))


@router.get("/entities/{entity_id}/snapshot")
def get_snapshot_by_id(
    entity_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if owned_entity(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    bundle = load_bundle(db, entity_id)
    if bundle is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    markets = db.query(models.MarketInstrument).all()
    return build_snapshot(bundle, markets, consolidated_net_worth(db, user.Id))


@router.get("/providers")
def get_providers(db: Session = Depends(get_db)):
    providers = db.query(models.Provider).order_by(models.Provider.Name).all()
    return [provider_dto(p) for p in providers]


@router.get("/markets")
def get_markets(db: Session = Depends(get_db)):
    markets = db.query(models.MarketInstrument).all()
    return [market_instrument_dto(m) for m in markets]


@router.get("/entities/{entity_id}/accounts")
def get_accounts(
    entity_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if owned_entity(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    accounts = db.query(models.Account).filter(models.Account.EntityId == entity_id).all()
    return [account_dto(a) for a in accounts]


def _parse_day(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _query_transactions(
    db: Session,
    entity_id: str,
    start: str | None,
    end: str | None,
) -> tuple[list[models.Transaction], date | None, date | None]:
    """Transactions for an entity, optionally bounded by an inclusive day range."""
    start_day = _parse_day(start)
    end_day = _parse_day(end)

    query = db.query(models.Transaction).filter(models.Transaction.EntityId == entity_id)
    if start_day is not None:
        query = query.filter(
            models.Transaction.Date >= datetime.combine(start_day, time.min, tzinfo=timezone.utc)
        )
    if end_day is not None:
        # end is inclusive, so bound by the start of the following day
        query = query.filter(
            models.Transaction.Date
            < datetime.combine(end_day + timedelta(days=1), time.min, tzinfo=timezone.utc)
        )
    return query.order_by(models.Transaction.Date.desc()).all(), start_day, end_day


@router.get("/entities/{entity_id}/transactions")
def get_transactions(
    entity_id: str,
    start: str | None = Query(None, description="Inclusive start date, YYYY-MM-DD"),
    end: str | None = Query(None, description="Inclusive end date, YYYY-MM-DD"),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if owned_entity(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    txs, _, _ = _query_transactions(db, entity_id, start, end)
    return [transaction_dto(t) for t in txs]


@router.get("/entities/{entity_id}/transactions/export")
def export_transactions(
    entity_id: str,
    format: str = Query("xlsx", pattern="^(xlsx|pdf)$"),
    start: str | None = Query(None, description="Inclusive start date, YYYY-MM-DD"),
    end: str | None = Query(None, description="Inclusive end date, YYYY-MM-DD"),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download the filtered ledger as an Excel workbook or a PDF statement."""
    entity = owned_entity(db, entity_id, user)
    if entity is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})

    txs, start_day, end_day = _query_transactions(db, entity_id, start, end)

    suffix = f"_{start_day}_to_{end_day}" if start_day and end_day else ""
    stem = f"{entity.Name.replace(' ', '_')}_transactions{suffix}"

    if format == "pdf":
        payload = build_pdf(txs, entity_name=entity.Name, start=start_day, end=end_day)
        media_type = "application/pdf"
        filename = f"{stem}.pdf"
    else:
        payload = build_xlsx(txs, entity_name=entity.Name, start=start_day, end=end_day)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{stem}.xlsx"

    return Response(
        content=payload,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{quote(filename)}",
            "Content-Length": str(len(payload)),
        },
    )


@router.get("/entities/{entity_id}/goals")
def get_goals(
    entity_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if owned_entity(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    goals = (
        db.query(models.Goal)
        .filter(models.Goal.EntityId == entity_id)
        .order_by(models.Goal.Priority)
        .all()
    )
    return [goal_dto(g) for g in goals]


@router.get("/entities/{entity_id}/advisor")
def get_advice(
    entity_id: str,
    months: int = Query(6, ge=1, le=24, description="How many months of history to analyse"),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run the advisory agents over this entity's books."""
    entity = owned_entity(db, entity_id, user)
    if entity is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})

    ctx = AdvisorContext(
        entity=entity,
        transactions=db.query(models.Transaction).filter(models.Transaction.EntityId == entity_id).all(),
        accounts=db.query(models.Account).filter(models.Account.EntityId == entity_id).all(),
        investments=db.query(models.Investment).filter(models.Investment.EntityId == entity_id).all(),
        liabilities=db.query(models.Liability).filter(models.Liability.EntityId == entity_id).all(),
        obligations=db.query(models.Obligation).filter(models.Obligation.EntityId == entity_id).all(),
        goals=db.query(models.Goal).filter(models.Goal.EntityId == entity_id).all(),
        risk_profile=db.query(models.RiskProfile).filter(models.RiskProfile.EntityId == entity_id).first(),
        cashflow_months=db.query(models.CashflowMonth)
        .filter(models.CashflowMonth.EntityId == entity_id)
        .order_by(models.CashflowMonth.SortOrder)
        .all(),
        months=months,
    )
    return run_advisors(ctx).as_dict()
