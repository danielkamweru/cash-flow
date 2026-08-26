from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app import models
from app.mappers import (
    account_dto,
    activity_event_dto,
    bnpl_dto,
    business_details_dto,
    profile_member_dto,
    supplier_dto,
    asset_dto,
    automation_rule_dto,
    credit_readiness_dto,
    entity_dto,
    goal_dto,
    investment_dto,
    liability_dto,
    market_instrument_dto,
    obligation_dto,
    risk_profile_dto,
    rule_run_dto,
    transaction_dto,
)
from app.schemas import iso


@dataclass
class EntityBundle:
    entity: models.Entity
    accounts: list[models.Account]
    transactions: list[models.Transaction]
    assets: list[models.Asset]
    investments: list[models.Investment]
    liabilities: list[models.Liability]
    obligations: list[models.Obligation]
    goals: list[models.Goal]
    risk_profile: models.RiskProfile | None
    credit_readiness: models.CreditReadiness | None
    automation_rules: list[models.AutomationRule]
    rule_runs: list[models.RuleRun]
    activity_events: list[models.ActivityEvent]
    cashflow_months: list[models.CashflowMonth]
    surplus_config: models.SurplusConfig | None
    suppliers: list[models.Supplier] = field(default_factory=list)
    bnpl_agreements: list[models.BnplAgreement] = field(default_factory=list)
    members: list[tuple[models.ProfileMember, models.User | None]] = field(default_factory=list)
    business_details: models.BusinessProfileDetails | None = None


def calculate_surplus(
    entity_id: str,
    liquid_balance: float,
    upcoming_obligations: float,
    emergency_buffer: float,
    discretionary_spend_ratio: float = 0.35,
    now: datetime | None = None,
) -> dict[str, Any]:
    raw = liquid_balance - upcoming_obligations - emergency_buffer
    safe_surplus = max(0.0, raw)
    safe_to_spend = round(safe_surplus * discretionary_spend_ratio)
    safe_to_invest = max(0.0, safe_surplus - safe_to_spend)
    ts = now or datetime.now(timezone.utc)
    return {
        "entityId": entity_id,
        "liquidBalance": liquid_balance,
        "upcomingObligations": upcoming_obligations,
        "emergencyBuffer": emergency_buffer,
        "safeToSpend": safe_to_spend,
        "safeToInvest": safe_to_invest,
        "lastCalculated": iso(ts),
        "formula": "MAX(0, Liquid − Obligations − Emergency Buffer)",
        "components": [
            {"label": "Liquid money", "amount": liquid_balance, "sign": "+"},
            {"label": "Upcoming obligations", "amount": upcoming_obligations, "sign": "-"},
            {"label": "Emergency buffer", "amount": emergency_buffer, "sign": "-"},
        ],
    }


def _clamp(n: float, mn: float = 0, mx: float = 100) -> float:
    return min(mx, max(mn, n))


def _tier_from_score(score: int) -> str:
    if score >= 85:
        return "ADVANCED"
    if score >= 70:
        return "STRONG"
    if score >= 55:
        return "GROWING"
    if score >= 35:
        return "BUILDER"
    return "FOUNDATION"


def calculate_wealth_health(bundle: EntityBundle, surplus: dict[str, Any]) -> dict[str, Any]:
    credit = bundle.credit_readiness
    income = credit.IncomeMonthly if credit else 0
    expenses = credit.ExpensesMonthly if credit else 1
    emergency_goal = next((g for g in bundle.goals if g.Category == "emergency"), None)
    emergency_current = (
        emergency_goal.Current
        if emergency_goal
        else sum(i.Value for i in bundle.investments if i.Type == "mmf")
    )
    emergency_target = expenses * (bundle.risk_profile.EmergencyFundMonthsTarget if bundle.risk_profile else 3)

    cash_flow_stability = 20 if income <= 0 else _clamp((income - expenses) / income * 100 + 40)
    liquidity = _clamp(surplus["liquidBalance"] / max(expenses, 1) * 25)
    emergency_fund = _clamp(emergency_current / max(emergency_target, 1) * 100)
    total_debt = sum(l.Balance for l in bundle.liabilities)
    debt_service = sum(l.MonthlyPayment for l in bundle.liabilities)
    total_assets = (
        sum(a.Balance for a in bundle.accounts)
        + sum(i.Value for i in bundle.investments)
        + sum(a.Value for a in bundle.assets)
    )
    debt_management = (
        40
        if income <= 0
        else _clamp(100 - debt_service / income * 180 - total_debt / max(total_assets, 1) * 40)
    )
    inv_value = sum(i.Value for i in bundle.investments)
    diversification = 10 if total_assets <= 0 else _clamp(inv_value / total_assets * 140)
    savings_tx = sum(
        1
        for t in bundle.transactions
        if t.Type == "outflow" and re.search(r"save|mmf|invest|sacco|goal", t.Category + t.Description, re.I)
    )
    savings_consistency = _clamp(30 + savings_tx * 12)
    goal_progress = (
        40
        if not bundle.goals
        else _clamp(sum(min(1, g.Current / max(g.Target, 1)) for g in bundle.goals) / len(bundle.goals) * 100)
    )

    factors = [
        {"key": "cashflow", "label": "Cash-flow stability", "score": int(round(cash_flow_stability)), "weight": 0.18, "note": "Income vs recurring expenses"},
        {"key": "liquidity", "label": "Liquidity", "score": int(round(liquidity)), "weight": 0.14, "note": "Liquid cover relative to monthly spend"},
        {"key": "emergency", "label": "Emergency fund", "score": int(round(emergency_fund)), "weight": 0.18, "note": "Buffer vs your target months"},
        {"key": "debt", "label": "Debt management", "score": int(round(debt_management)), "weight": 0.16, "note": "Service burden and leverage"},
        {"key": "diversification", "label": "Investment diversification", "score": int(round(diversification)), "weight": 0.12, "note": "Share of wealth in productive assets"},
        {"key": "savings", "label": "Savings consistency", "score": int(round(savings_consistency)), "weight": 0.12, "note": "Recent saving/investing activity"},
        {"key": "goals", "label": "Goal progress", "score": int(round(goal_progress)), "weight": 0.1, "note": "Average progress across active goals"},
    ]
    score = int(round(sum(f["score"] * f["weight"] for f in factors)))
    return {
        "entityId": bundle.entity.Id,
        "tier": _tier_from_score(score),
        "score": score,
        "factors": factors,
        "lastCalculated": iso(datetime.now(timezone.utc)),
        "disclaimer": "Wealth Loop financial-health indicator. This is not a CRB score, credit bureau report, or loan approval guarantee.",
    }


def _fmt_kes(n: float) -> str:
    return f"{n:,.0f}"


def build_recommendations(bundle: EntityBundle, surplus: dict[str, Any], health: dict[str, Any]) -> list[dict[str, Any]]:
    recs: list[dict[str, Any]] = []
    primary_goal = next(iter(sorted(bundle.goals, key=lambda g: g.Priority)), None)
    total = (
        sum(a.Balance for a in bundle.accounts)
        + sum(i.Value for i in bundle.investments)
        + sum(a.Value for a in bundle.assets)
    )
    equity_share = sum(i.Value for i in bundle.investments if i.Type == "nse") / max(total, 1)

    if surplus["safeToInvest"] >= 10000 and primary_goal is not None:
        remaining = max(0, primary_goal.Target - primary_goal.Current)
        recs.append(
            {
                "id": f"rec-{bundle.entity.Id}-goal",
                "entityId": bundle.entity.Id,
                "title": f"Route surplus toward {primary_goal.Name}",
                "summary": f"You currently have {_fmt_kes(surplus['safeToInvest'])} KES available after obligations and your emergency buffer.",
                "why": [
                    f"Primary goal “{primary_goal.Name}” still needs KES {_fmt_kes(remaining)}.",
                    "Emergency reserve logic is already applied before this surplus is shown.",
                    f"Wealth Health is {health['tier']} — prioritising structured progress over idle cash.",
                ],
                "opportunity": f"Allocate part of your safe surplus to {primary_goal.Name} this month.",
                "risk": "low",
                "liquidity": "Depends on destination (MMF / SACCO / locked goal pot)",
                "timeHorizon": primary_goal.Deadline.strftime("%Y-%m-%d"),
                "assumptions": [
                    "Balances and obligations remain accurate.",
                    "No unexpected large expense arises before the next payday.",
                    "You retain final approval — no money moves automatically.",
                ],
                "actionLabel": "Review allocation plan",
                "actionState": "demo",
                "relatedGoalId": primary_goal.Id,
            }
        )

    tolerance = bundle.risk_profile.Tolerance if bundle.risk_profile else None
    if equity_share < 0.15 and tolerance != "low" and surplus["safeToInvest"] >= 5000:
        horizon = bundle.risk_profile.Horizon if bundle.risk_profile else "medium"
        recs.append(
            {
                "id": f"rec-{bundle.entity.Id}-equity",
                "entityId": bundle.entity.Id,
                "title": "Consider modest NSE exposure (demo opportunity)",
                "summary": "Your portfolio has limited equity exposure relative to a growth-oriented profile.",
                "why": [
                    "Emergency reserve is protected in the surplus calculation.",
                    f"Risk horizon is {horizon}-term with {tolerance} tolerance.",
                    "Equity share is currently low — diversification may improve long-term growth potential.",
                ],
                "opportunity": "Explore demo NSE opportunities that match liquidity and risk filters.",
                "risk": "elevated",
                "liquidity": "Typically T+2 on NSE (demo)",
                "timeHorizon": "3+ years",
                "assumptions": [
                    "Market data shown is labelled demo/sample — not live prices.",
                    "Past or illustrated yields are not guarantees.",
                    "You must approve any future connected trade separately.",
                ],
                "actionLabel": "Open investment intelligence",
                "actionState": "demo",
                "relatedGoalId": None,
            }
        )

    emergency_factor = next((f for f in health["factors"] if f["key"] == "emergency"), None)
    if emergency_factor is not None and emergency_factor["score"] < 70:
        emergency_goal = next((g for g in bundle.goals if g.Category == "emergency"), None)
        recs.append(
            {
                "id": f"rec-{bundle.entity.Id}-buffer",
                "entityId": bundle.entity.Id,
                "title": "Strengthen emergency buffer first",
                "summary": "Before increasing investment risk, close more of your emergency-fund gap.",
                "why": [
                    "Emergency fund factor is below target in Wealth Health.",
                    "A funded buffer reduces forced selling and expensive short-term borrowing.",
                    "Safe-to-invest shrinks until the buffer rule is satisfied — by design.",
                ],
                "opportunity": "Top up emergency fund with the next safe surplus slice.",
                "risk": "low",
                "liquidity": "Keep in liquid MMF or cash equivalent",
                "timeHorizon": "0–6 months",
                "assumptions": ["Target months are based on your risk profile settings."],
                "actionLabel": "View emergency goal",
                "actionState": "demo",
                "relatedGoalId": emergency_goal.Id if emergency_goal else None,
            }
        )

    return recs


def build_cashflow(bundle: EntityBundle, months: int = 6) -> list[dict[str, Any]]:
    """Monthly inflow and outflow rolled up from the actual ledger.

    The stored CashflowMonth rows are only a fallback for an entity that has no
    transactions yet — once a user records or collects anything, the chart has
    to follow their real money rather than a seeded curve.
    """
    settled = [
        t for t in bundle.transactions
        if (t.Status or "completed") == "completed" and t.Date is not None
    ]
    if not settled:
        stored = sorted(bundle.cashflow_months, key=lambda c: c.SortOrder)
        return [{"month": c.Month, "inflow": c.Inflow, "outflow": c.Outflow} for c in stored]

    now = datetime.now(timezone.utc)
    # Walk back `months` calendar months, oldest first.
    keys: list[tuple[int, int]] = []
    year, month = now.year, now.month
    for _ in range(months):
        keys.append((year, month))
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    keys.reverse()

    totals = {k: {"inflow": 0.0, "outflow": 0.0} for k in keys}
    for t in settled:
        key = (t.Date.year, t.Date.month)
        if key in totals:
            bucket = "inflow" if t.Type == "inflow" else "outflow"
            if t.Type in ("inflow", "outflow"):
                totals[key][bucket] += t.Amount

    labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return [
        {"month": labels[m - 1], "inflow": round(totals[(y, m)]["inflow"], 2),
         "outflow": round(totals[(y, m)]["outflow"], 2)}
        for (y, m) in keys
    ]


def build_snapshot(
    bundle: EntityBundle,
    markets: list[models.MarketInstrument],
    all_entities_net_worth: float,
) -> dict[str, Any]:
    liquid_accounts = [a for a in bundle.accounts if a.IsLiquid]
    sacco_deposit = sum(a.Balance for a in bundle.accounts if a.Provider == "sacco")
    investments_value = sum(i.Value for i in bundle.investments)
    assets_value = sum(a.Value for a in bundle.assets)
    liabilities_value = sum(l.Balance for l in bundle.liabilities)
    computed_liquid = sum(a.Balance for a in liquid_accounts)

    upcoming = sum(
        o.Amount for o in bundle.obligations if o.Status in ("upcoming", "overdue")
    )

    cfg = bundle.surplus_config
    liquid_balance = cfg.LiquidBalanceOverride if cfg and cfg.LiquidBalanceOverride is not None else computed_liquid
    emergency_buffer = cfg.EmergencyBufferOverride if cfg and cfg.EmergencyBufferOverride is not None else 40000
    ratio = cfg.DiscretionarySpendRatio if cfg else 0.33

    surplus = calculate_surplus(bundle.entity.Id, liquid_balance, upcoming, emergency_buffer, ratio)
    health = calculate_wealth_health(bundle, surplus)
    recommendations = build_recommendations(bundle, surplus, health)
    net_worth = computed_liquid + sacco_deposit + investments_value + assets_value - liabilities_value

    cashflow = build_cashflow(bundle)

    return {
        "entity": entity_dto(bundle.entity),
        "netWorth": net_worth,
        "liquid": liquid_balance,
        "investments": investments_value + sacco_deposit,
        "assets": assets_value,
        "liabilities": liabilities_value,
        "surplus": surplus,
        "health": health,
        "recommendations": recommendations,
        "accounts": [account_dto(a) for a in bundle.accounts],
        "transactions": [transaction_dto(t) for t in bundle.transactions],
        "assetsList": [asset_dto(a) for a in bundle.assets],
        "investmentsList": [investment_dto(i) for i in bundle.investments],
        "liabilitiesList": [liability_dto(l) for l in bundle.liabilities],
        "obligations": [obligation_dto(o) for o in bundle.obligations],
        "goals": [goal_dto(g) for g in bundle.goals],
        "cashflow": cashflow,
        "credit": credit_readiness_dto(bundle.credit_readiness) if bundle.credit_readiness else None,
        "automation": [automation_rule_dto(a) for a in bundle.automation_rules],
        "ruleRuns": [rule_run_dto(a) for a in bundle.rule_runs],
        "activity": [activity_event_dto(a) for a in bundle.activity_events],
        "risk": risk_profile_dto(bundle.risk_profile) if bundle.risk_profile else None,
        "markets": [market_instrument_dto(m) for m in markets],
        "suppliers": [
            supplier_dto(sup, [a for a in bundle.bnpl_agreements if a.SupplierId == sup.Id])
            for sup in bundle.suppliers
        ],
        "bnpl": [bnpl_dto(a) for a in bundle.bnpl_agreements],
        "members": [profile_member_dto(m, u) for m, u in bundle.members],
        "businessDetails": (
            business_details_dto(bundle.business_details) if bundle.business_details else None
        ),
        "consolidatedNetWorth": all_entities_net_worth,
        "asOf": iso(datetime.now(timezone.utc)),
    }
