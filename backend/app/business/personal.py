from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app import models
from app.schemas import iso

FIXED_CATEGORIES = {
    "Housing",
    "Utilities",
    "Internet",
    "Subscriptions",
    "Debt",
    "Insurance",
    "Transport",
    "Education",
    "Health",
}
FLEXIBLE_CATEGORIES = {
    "Food",
    "Groceries",
    "Transport",
    "Shopping",
    "General",
}
ENTERTAINMENT_CATEGORIES = {
    "Entertainment",
    "Dining",
    "Sports",
    "Hobbies",
    "Social",
    "Travel",
}


def _monthly_expense_for(entity_id: str, db: Session, now: datetime | None = None) -> float:
    now = now or datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_month = (month_start + timedelta(days=32)).replace(day=1)
    outflows = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.EntityId == entity_id,
            models.Transaction.Type == "outflow",
            models.Transaction.Date >= month_start,
            models.Transaction.Date < next_month,
        )
        .all()
    )
    return float(sum(t.Amount for t in outflows))


def _daily_discretionary_burn(entity_id: str, db: Session, now: datetime | None = None) -> float:
    now = now or datetime.now(timezone.utc)
    window_start = now - timedelta(days=14)
    txs = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.EntityId == entity_id,
            models.Transaction.Type == "outflow",
            models.Transaction.Date >= window_start,
            models.Transaction.Date < now,
        )
        .all()
    )
    discretionary = [
        t
        for t in txs
        if t.Category in FLEXIBLE_CATEGORIES or t.Category in ENTERTAINMENT_CATEGORIES
        or re.search(r"food|dining|entertainment|sport|hobby|social|travel|grocer", t.Category + t.Description, re.I)
    ]
    total = float(sum(t.Amount for t in discretionary))
    days = max((now - window_start).days, 1)
    return round(total / days, 2)


def _emergity_fund_status(entity_id: str, db: Session) -> dict[str, Any]:
    emergency_goal = (
        db.query(models.Goal)
        .filter(models.Goal.EntityId == entity_id, models.Goal.Category == "emergency")
        .first()
    )
    risk = db.query(models.RiskProfile).filter(models.RiskProfile.EntityId == entity_id).first()
    monthly_expenses = _monthly_expense_for(entity_id, db)
    target_months = int(risk.EmergencyFundMonthsTarget if risk else 3)
    target = monthly_expenses * target_months

    current = float(emergency_goal.Current if emergency_goal else 0)
    mmf_value = float(
        sum(i.Value for i in db.query(models.Investment).filter(models.Investment.EntityId == entity_id, models.Investment.Type == "mmf").all())
    )
    liquid_accounts = (
        db.query(models.Account)
        .filter(models.Account.EntityId == entity_id, models.Account.IsLiquid == True)
        .all()
    )
    liquid = float(sum(a.Balance for a in liquid_accounts))
    current_total = current + mmf_value + liquid
    months_covered = round(current_total / max(monthly_expenses, 1), 2)
    intact = months_covered >= target_months

    return {
        "current": round(current_total, 2),
        "target": round(target, 2),
        "monthsCovered": months_covered,
        "targetMonths": target_months,
        "intact": intact,
        "plainStatus": (
            f"Your emergency money can cover about {months_covered:.1f} months of spending."
            if intact
            else f"You need about {target_months} months covered. You're at {months_covered:.1f} months."
        ),
    }


def _next_bill(entity_id: str, db: Session, now: datetime | None = None) -> dict[str, Any] | None:
    now = now or datetime.now(timezone.utc)
    upcoming = (
        db.query(models.Obligation)
        .filter(models.Obligation.EntityId == entity_id, models.Obligation.Status.in_(["upcoming", "overdue"]))
        .order_by(models.Obligation.DueDate)
        .all()
    )
    if not upcoming:
        return None
    obligation = upcoming[0]
    days_until_due = max((obligation.DueDate.replace(tzinfo=timezone.utc) - now).days, 0)
    account = (
        db.query(models.Account)
        .filter(models.Account.EntityId == entity_id, models.Account.IsLiquid == True)
        .first()
    )
    return {
        "id": obligation.Id,
        "name": obligation.Name,
        "amount": obligation.Amount,
        "daysUntilDue": days_until_due,
        "plainWarning": (
            f"{obligation.Name} for KES {obligation.Amount:,.0f} is due in {days_until_due} days."
            if days_until_due <= 7
            else None
        ),
        "paybillNumber": account.Institution if account else None,
    }


def _unpaid_bills(entity_id: str, db: Session, now: datetime | None = None) -> list[dict[str, Any]]:
    now = now or datetime.now(timezone.utc)
    obligations = (
        db.query(models.Obligation)
        .filter(models.Obligation.EntityId == entity_id, models.Obligation.Status.in_(["upcoming", "overdue"]))
        .order_by(models.Obligation.DueDate)
        .all()
    )
    result = []
    for o in obligations:
        days_until_due = max((o.DueDate.replace(tzinfo=timezone.utc) - now).days, 0)
        result.append(
            {
                "id": o.Id,
                "name": o.Name,
                "amount": o.Amount,
                "daysUntilDue": days_until_due,
                "plainWarning": (
                    f"{o.Name} is due in {days_until_due} days — make sure you have the money."
                    if days_until_due <= 7
                    else None
                ),
                "status": o.Status,
            }
        )
    return result


def _envelopes(entity_id: str, db: Session, now: datetime | None = None) -> list[dict[str, Any]]:
    now = now or datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_month = (month_start + timedelta(days=32)).replace(day=1)
    txs = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.EntityId == entity_id,
            models.Transaction.Type == "outflow",
            models.Transaction.Date >= month_start,
            models.Transaction.Date < next_month,
        )
        .all()
    )

    category_map: dict[str, dict[str, Any]] = {}
    for t in txs:
        cat = t.Category or "Other"
        if cat not in category_map:
            category_map[cat] = {"spent": 0.0, "txs": 0}
        category_map[cat]["spent"] += t.Amount
        category_map[cat]["txs"] += 1

    envelope_defs = [
        ("Housing", "Rent / mortgage", 40000),
        ("Food & Groceries", "Food and groceries", 25000),
        ("Transport", "Fuel, fare, matatu", 12000),
        ("Utilities", "Power, water, internet", 8000),
        ("Entertainment", "Eating out, movies, fun", 10000),
        ("Education", "School fees, books", 15000),
        ("Health", "Medical, pharmacy", 7000),
        ("Shopping", "Clothes, gadgets", 8000),
    ]

    envelopes = []
    for name, kind, limit in envelope_defs:
        spent = category_map.get(name, {}).get("spent", 0.0)
        remaining = max(limit - spent, 0)
        utilization = min((spent / max(limit, 1)) * 100, 100)
        if utilization >= 100:
            plain = f"You've spent all your {kind.lower()} money for this month."
        elif utilization >= 80:
            plain = f"Almost out of {kind.lower()} money — slow down."
        else:
            plain = f"You have KES {remaining:,.0f} left for {kind.lower()} this month."
        envelopes.append(
            {
                "id": name.lower().replace(" ", "-"),
                "name": name,
                "kind": kind,
                "monthlyLimit": limit,
                "spentAmount": round(spent, 2),
                "remaining": round(remaining, 2),
                "utilizationPct": round(utilization, 1),
                "plainStatus": plain,
            }
        )
    return envelopes


def _runway(entity_id: str, db: Session, now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    cfg = db.query(models.SurplusConfig).filter(models.SurplusConfig.EntityId == entity_id).first()
    accounts = db.query(models.Account).filter(models.Account.EntityId == entity_id, models.Account.IsLiquid == True).all()
    liquid = float(sum(a.Balance for a in accounts))
    upcoming = (
        db.query(models.Obligation)
        .filter(models.Obligation.EntityId == entity_id, models.Obligation.Status.in_(["upcoming", "overdue"]))
        .all()
    )
    obligations_30d = sum(o.Amount for o in upcoming if (o.DueDate.replace(tzinfo=timezone.utc) - now).days <= 30)
    emergency_buffer = float(cfg.EmergencyBufferOverride if cfg and cfg.EmergencyBufferOverride is not None else 40000)
    daily_burn = _daily_discretionary_burn(entity_id, db, now)

    available = max(liquid - obligations_30d - emergency_buffer, 0)
    if daily_burn > 0:
        days_until_shortfall = int(available / daily_burn)
        shortfall_date = (now + timedelta(days=days_until_shortfall)).date().isoformat()
    else:
        days_until_shortfall = None
        shortfall_date = None

    plain = None
    if days_until_shortfall is not None and days_until_shortfall <= 14:
        plain = (
            f"At your current spending pace, you may run short around {shortfall_date} — "
            f"about {days_until_shortfall} days from now. Watch your spending."
        )
    elif days_until_shortfall is not None and days_until_shortfall <= 30:
        plain = (
            f"You have about {days_until_shortfall} days of spending money left after bills and savings."
        )

    return {
        "shortfallDate": shortfall_date,
        "daysUntilShortfall": days_until_shortfall,
        "plainShortfallMessage": plain,
        "dailyDiscretionaryBurn": daily_burn,
    }


def _parse_yield_pct(value: str | None) -> float:
    if not value:
        return -1.0
    match = re.search(r"([\d.]+)", value)
    if not match:
        return -1.0
    try:
        return float(match.group(1))
    except ValueError:
        return -1.0


def _instrument_card(m: models.MarketInstrument, amount: float, weight: float, role: str) -> dict[str, Any]:
    return {
        "instrumentId": m.Id,
        "type": m.Type,
        "role": role,
        "name": m.Name,
        "provider": m.Provider,
        "yieldLabel": m.YieldLabel,
        "yieldValue": m.YieldValue,
        "risk": m.Risk,
        "liquidity": m.Liquidity,
        "minInvestment": m.MinInvestment,
        "dataStatus": m.DataStatus,
        "weight": round(weight, 4),
        "amount": round(amount, 2),
        "notes": m.Notes,
        "recommended": True,
    }


def _pick_best(
    markets: list[models.MarketInstrument],
    types: set[str],
    amount: float,
) -> models.MarketInstrument | None:
    candidates = [m for m in markets if m.Type in types]
    if not candidates:
        return None
    # Prefer instruments the amount can enter; fall back to best yield overall
    affordable = [m for m in candidates if m.MinInvestment <= amount]
    pool = affordable or candidates
    return max(pool, key=lambda m: (_parse_yield_pct(m.YieldValue), -m.MinInvestment))


def _build_allocation_legs(
    suggested: float,
    tolerance: str,
    horizon: str,
    markets: list[models.MarketInstrument],
) -> tuple[str, str, list[dict[str, Any]]]:
    """Return (title, plainAdvice, allocation legs) for surplus after expenses + emergency."""
    if tolerance == "low" or horizon == "short":
        title = "Park surplus in the best Money Market Fund"
        recipe = [("mmf", {"mmf"}, 1.0, "safety")]
        plain_prefix = (
            f"With KES {suggested:,.0f} safe after expenses and your emergency fund, "
            f"your low-risk / short-horizon profile fits a top-yielding MMF."
        )
    elif tolerance == "moderate":
        title = "Split between MMF and a balanced fund"
        # Balanced = bond / infra bond sleeve + defensive MMF
        recipe = [
            ("mmf", {"mmf"}, 0.6, "safety"),
            ("balanced", {"tbond", "infra_bond", "tbill"}, 0.4, "balanced"),
        ]
        plain_prefix = (
            f"With KES {suggested:,.0f} safe after expenses and your emergency fund, "
            f"split between the best MMF for liquidity and a balanced bond fund for yield."
        )
    else:
        title = "Diversify across MMF, bonds, and equities"
        recipe = [
            ("mmf", {"mmf"}, 0.3, "safety"),
            ("bond", {"tbond", "infra_bond", "tbill"}, 0.3, "income"),
            ("equity", {"nse"}, 0.4, "growth"),
        ]
        plain_prefix = (
            f"With KES {suggested:,.0f} and a {tolerance} profile, allocate across the best "
            f"MMF, bond, and NSE options from market intelligence."
        )

    legs: list[dict[str, Any]] = []
    leftover = 0.0
    for role_key, types, weight, role in recipe:
        target = round(suggested * weight, 2)
        pick = _pick_best(markets, types, target)
        if pick is None:
            leftover += target
            continue
        if target < pick.MinInvestment:
            # Can't enter this sleeve — roll into leftover for MMF top-up
            leftover += target
            continue
        legs.append(_instrument_card(pick, target, weight, role))

    if leftover > 0:
        mmf = _pick_best(markets, {"mmf"}, leftover)
        if mmf and leftover >= mmf.MinInvestment:
            existing = next((leg for leg in legs if leg["type"] == "mmf"), None)
            if existing:
                existing["amount"] = round(existing["amount"] + leftover, 2)
                existing["weight"] = round(existing["amount"] / max(suggested, 1), 4)
            else:
                legs.append(_instrument_card(mmf, leftover, leftover / max(suggested, 1), "safety"))
            leftover = 0.0

    names = ", ".join(f"{leg['name']} ({leg['amount']:,.0f})" for leg in legs) or "available market options"
    plain = f"{plain_prefix} Recommended: {names}."
    if leftover > 0:
        plain += f" KES {leftover:,.0f} could not be allocated under current minimums."

    return title, plain, legs


def get_automation_enabled(entity_id: str, db: Session) -> bool:
    cfg = db.query(models.SurplusConfig).filter(models.SurplusConfig.EntityId == entity_id).first()
    if cfg is None:
        return True
    return bool(getattr(cfg, "AutomationEnabled", True))


def set_automation_enabled(entity_id: str, enabled: bool, db: Session) -> dict[str, Any]:
    cfg = db.query(models.SurplusConfig).filter(models.SurplusConfig.EntityId == entity_id).first()
    if cfg is None:
        cfg = models.SurplusConfig(EntityId=entity_id, DiscretionarySpendRatio=0.33, AutomationEnabled=enabled)
        db.add(cfg)
    else:
        cfg.AutomationEnabled = enabled

    rules = (
        db.query(models.AutomationRule)
        .filter(models.AutomationRule.EntityId == entity_id)
        .all()
    )
    for rule in rules:
        if enabled:
            rule.Status = "active_demo"
            if "sweep" in rule.Name.lower() or "surplus" in rule.Name.lower() or "payday" in rule.Name.lower():
                rule.Action = (
                    "Autonomously route safe surplus to ranked MMF / bond / equity picks "
                    "(demo — no live broker movement)"
                )
        else:
            rule.Status = "paused"
            rule.Action = (
                "Recommendation only — best MMF / stocks / bonds shown under Market Intelligence"
            )

    db.add(
        models.ActivityEvent(
            EntityId=entity_id,
            Timestamp=datetime.now(timezone.utc),
            Title="Automation " + ("enabled" if enabled else "disabled"),
            Detail=(
                "Surplus investing will run autonomously using personal market rankings."
                if enabled
                else "Surplus investing paused. Ranked market recommendations remain available."
            ),
            Kind="system",
        )
    )
    db.commit()
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


def _investment_advice(entity_id: str, safe_to_invest: float, db: Session, automation_enabled: bool) -> dict[str, Any]:
    risk = db.query(models.RiskProfile).filter(models.RiskProfile.EntityId == entity_id).first()
    emergency = _emergity_fund_status(entity_id, db)
    monthly_expenses = _monthly_expense_for(entity_id, db)
    markets = db.query(models.MarketInstrument).all()

    allowed = safe_to_invest >= 5000 and emergency["intact"]
    if not allowed:
        reason = []
        if safe_to_invest < 5000:
            reason.append("Your safe surplus is below the minimum investment threshold.")
        if not emergency["intact"]:
            reason.append("Your emergency fund is not yet at target.")
        plain = " ".join(reason) if reason else "Wait until your emergency fund is stronger."
        return {
            "allowed": False,
            "title": "Hold off on investing for now",
            "plainAdvice": plain,
            "suggestedAmount": 0,
            "strategy": "hold",
            "allocations": [],
            "automationEnabled": automation_enabled,
            "autonomous": False,
            "automationStatus": "blocked",
            "dataStatus": "demo",
        }

    tolerance = (risk.Tolerance if risk else "moderate").lower()
    horizon = risk.Horizon if risk else "medium"
    suggested = min(safe_to_invest, monthly_expenses * 0.5 if monthly_expenses > 0 else safe_to_invest)
    suggested = max(suggested, 0)

    title, plain, allocations = _build_allocation_legs(suggested, tolerance, horizon, markets)
    strategy = (
        "mmf"
        if tolerance == "low" or horizon == "short"
        else "mmf_balanced_split"
        if tolerance == "moderate"
        else "diversified_growth"
    )

    autonomous = bool(automation_enabled and allocations)
    if autonomous:
        plain += (
            " Automation is ON — Cash-Flow will route this surplus using these ranked picks "
            "(demo orchestration; no live broker yet)."
        )
        automation_status = "autonomous"
    else:
        plain += (
            " Automation is OFF — review these picks under Market Intelligence and invest when ready."
        )
        automation_status = "recommend_only"

    return {
        "allowed": True,
        "title": title,
        "plainAdvice": plain,
        "suggestedAmount": round(suggested, 2),
        "strategy": strategy,
        "allocations": allocations,
        "automationEnabled": automation_enabled,
        "autonomous": autonomous,
        "automationStatus": automation_status,
        "dataStatus": "demo",
    }


def _payment_actions(entity_id: str, unpaid_bills: list[dict[str, Any]], db: Session) -> list[dict[str, Any]]:
    actions = []
    for b in unpaid_bills:
        if b["status"] == "overdue" or (b["daysUntilDue"] is not None and b["daysUntilDue"] <= 3):
            actions.append(
                {
                    "actionId": f"pay-{b['id']}",
                    "paymentMethod": "mpesa-stk-push",
                    "title": f"Pay {b['name']} now",
                    "plainReason": f"{b['name']} is due soon. Paying now avoids penalties.",
                    "amount": b["amount"],
                    "billId": b["id"],
                    "endpointHint": "/api/mpesa/stk-push",
                    "blockedReason": None,
                }
            )
        else:
            actions.append(
                {
                    "actionId": f"remind-{b['id']}",
                    "paymentMethod": "none",
                    "title": f"Remember {b['name']}",
                    "plainReason": f"{b['name']} is coming up in {b['daysUntilDue']} days. Plan ahead.",
                    "amount": b["amount"],
                    "billId": b["id"],
                    "endpointHint": None,
                    "blockedReason": None,
                }
            )
    return actions[:5]


def build_personal_coach_home(entity_id: str, db: Session, now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)

    cfg = db.query(models.SurplusConfig).filter(models.SurplusConfig.EntityId == entity_id).first()
    accounts = db.query(models.Account).filter(models.Account.EntityId == entity_id, models.Account.IsLiquid == True).all()
    liquid = float(sum(a.Balance for a in accounts))
    obligations = (
        db.query(models.Obligation)
        .filter(models.Obligation.EntityId == entity_id, models.Obligation.Status.in_(["upcoming", "overdue"]))
        .all()
    )
    upcoming_total = float(sum(o.Amount for o in obligations))
    emergency_buffer = float(cfg.EmergencyBufferOverride if cfg and cfg.EmergencyBufferOverride is not None else 40000)
    ratio = float(cfg.DiscretionarySpendRatio if cfg else 0.35)
    automation_enabled = bool(getattr(cfg, "AutomationEnabled", True) if cfg else True)

    raw = liquid - upcoming_total - emergency_buffer
    safe_surplus = max(0.0, raw)
    safe_to_spend = round(safe_surplus * ratio)
    safe_to_invest = max(0.0, safe_surplus - safe_to_spend)

    emergency = _emergity_fund_status(entity_id, db)
    next_bill = _next_bill(entity_id, db, now)
    unpaid = _unpaid_bills(entity_id, db, now)
    envelopes = _envelopes(entity_id, db, now)
    runway = _runway(entity_id, db, now)
    advice = _investment_advice(entity_id, safe_to_invest, db, automation_enabled)
    payment_actions = _payment_actions(entity_id, unpaid, db)

    warnings = []
    if runway["plainShortfallMessage"]:
        warnings.append(runway["plainShortfallMessage"])
    if next_bill and next_bill["plainWarning"]:
        warnings.append(next_bill["plainWarning"])
    for b in unpaid:
        if b["plainWarning"]:
            warnings.append(b["plainWarning"])
    if not emergency["intact"]:
        warnings.append("Your emergency fund is still below target. Keep building it first.")

    if runway["daysUntilShortfall"] is not None and runway["daysUntilShortfall"] <= 7:
        traffic = "red"
        headline = "Money is tight right now. Avoid extra spending until bills are covered."
    elif runway["daysUntilShortfall"] is not None and runway["daysUntilShortfall"] <= 21 or (next_bill and next_bill["daysUntilDue"] <= 5):
        traffic = "amber"
        headline = "Be careful this week. Your next bill is close and your buffer is thin."
    else:
        traffic = "green"
        headline = "You're in a good spot. Your bills are covered and you have money to use today."

    return {
        "entityId": entity_id,
        "asOf": iso(now),
        "trafficLight": traffic,
        "headline": headline,
        "safeToSpendToday": safe_to_spend,
        "safeToInvest": safe_to_invest,
        "emergency": emergency,
        "nextBill": next_bill,
        "unpaidBills": unpaid,
        "envelopes": envelopes,
        "runway": runway,
        "investmentAdvice": advice,
        "automation": {
            "enabled": automation_enabled,
            "mode": "autonomous" if automation_enabled else "recommend_only",
            "label": (
                "Autonomous surplus investing"
                if automation_enabled
                else "Recommendations only (Market Intelligence)"
            ),
        },
        "paymentActions": payment_actions,
        "warnings": warnings,
        "success": True,
    }
