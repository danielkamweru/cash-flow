"""The advisory agents themselves, plus the synthesizer that ranks their output."""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from app import models

# Categories that a Kenyan household generally cannot cut this month.
ESSENTIAL_CATEGORIES = {
    "housing", "rent", "food", "groceries", "utilities", "transport",
    "education", "health", "medical", "insurance", "family", "tax",
    "suppliers", "overheads", "income",
}

# Where surplus can go, with the liquidity and risk trade-offs that decide the split.
INSTRUMENT_GUIDE = {
    "mmf": {
        "label": "Money Market Fund",
        "liquidity": "T+1 — withdraw in a day",
        "risk": "low",
        "use": "Emergency fund and short-term savings",
    },
    "sacco": {
        "label": "SACCO deposits",
        "liquidity": "Locked — dividends annually",
        "risk": "moderate",
        "use": "Medium-term savings and access to member credit",
    },
    "tbill": {
        "label": "Treasury Bills",
        "liquidity": "91 / 182 / 364 days to maturity",
        "risk": "low",
        "use": "Known-date goals — school fees, deposits",
    },
    "tbond": {
        "label": "Treasury / Infrastructure Bonds",
        "liquidity": "Secondary market via NSE",
        "risk": "moderate",
        "use": "Long-horizon growth; infrastructure bond coupons are tax-free",
    },
    "nse": {
        "label": "NSE equities",
        "liquidity": "T+2",
        "risk": "elevated",
        "use": "Long-horizon growth only, after the buffer is funded",
    },
}

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}


@dataclass
class Finding:
    agent: str
    severity: str          # critical | high | medium | low | info
    title: str
    detail: str
    evidence: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "agent": self.agent,
            "severity": self.severity,
            "title": self.title,
            "detail": self.detail,
            "evidence": self.evidence,
            "metrics": self.metrics,
        }


@dataclass
class Action:
    """A concrete, costed step the user can accept or ignore."""

    title: str
    rationale: str
    amount: float | None = None
    cadence: str | None = None       # e.g. "monthly"
    instrument: str | None = None    # key into INSTRUMENT_GUIDE
    priority: int = 5
    assumptions: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        guide = INSTRUMENT_GUIDE.get(self.instrument or "", {})
        return {
            "title": self.title,
            "rationale": self.rationale,
            "amount": round(self.amount, 2) if self.amount is not None else None,
            "cadence": self.cadence,
            "instrument": self.instrument,
            "instrumentLabel": guide.get("label"),
            "liquidity": guide.get("liquidity"),
            "risk": guide.get("risk"),
            "priority": self.priority,
            "assumptions": self.assumptions,
        }


@dataclass
class AdvisorContext:
    """Everything the agents are allowed to reason over."""

    entity: models.Entity
    transactions: list[models.Transaction]
    accounts: list[models.Account]
    investments: list[models.Investment]
    liabilities: list[models.Liability]
    obligations: list[models.Obligation]
    goals: list[models.Goal]
    risk_profile: models.RiskProfile | None
    cashflow_months: list[models.CashflowMonth]
    months: int = 6

    # ---- derived helpers -------------------------------------------------

    @property
    def settled(self) -> list[models.Transaction]:
        """Pending and failed transactions must not sway the analysis."""
        return [t for t in self.transactions if (t.Status or "completed") == "completed"]

    @property
    def window_start(self) -> datetime:
        return datetime.now(timezone.utc) - timedelta(days=30 * self.months)

    @property
    def recent(self) -> list[models.Transaction]:
        start = self.window_start
        return [t for t in self.settled if t.Date and t.Date >= start]

    @property
    def monthly_income(self) -> float:
        if self.cashflow_months:
            return statistics.fmean(c.Inflow for c in self.cashflow_months)
        inflow = sum(t.Amount for t in self.recent if t.Type == "inflow")
        return inflow / max(self.months, 1)

    @property
    def monthly_expenses(self) -> float:
        if self.cashflow_months:
            return statistics.fmean(c.Outflow for c in self.cashflow_months)
        outflow = sum(t.Amount for t in self.recent if t.Type == "outflow")
        return outflow / max(self.months, 1)

    @property
    def liquid(self) -> float:
        return sum(a.Balance for a in self.accounts if a.IsLiquid)

    @property
    def emergency_months_target(self) -> int:
        if self.risk_profile and self.risk_profile.EmergencyFundMonthsTarget:
            return self.risk_profile.EmergencyFundMonthsTarget
        return 3

    @property
    def emergency_cover(self) -> float:
        """Liquid cash plus daily-access funds — what is truly reachable in a crisis."""
        instant = sum(i.Value for i in self.investments if i.Liquidity == "daily")
        goal = next((g for g in self.goals if g.Category == "emergency"), None)
        return self.liquid + instant + (goal.Current if goal else 0.0)

    @property
    def tolerance(self) -> str:
        return (self.risk_profile.Tolerance if self.risk_profile else "moderate") or "moderate"

    @property
    def horizon(self) -> str:
        return (self.risk_profile.Horizon if self.risk_profile else "medium") or "medium"


def _kes(n: float) -> str:
    return f"KES {n:,.0f}"


def _pct(n: float) -> str:
    return f"{n * 100:.0f}%"


# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------


def spending_agent(ctx: AdvisorContext) -> tuple[list[Finding], list[Action]]:
    """Break spending into categories and flag where the money actually goes."""
    findings: list[Finding] = []
    actions: list[Action] = []

    outflows = [t for t in ctx.recent if t.Type == "outflow"]
    if not outflows:
        return [Finding("spending", "info", "Not enough spending history yet",
                        "Record or connect a few months of transactions and this analysis sharpens.")], []

    totals: dict[str, float] = {}
    for t in outflows:
        totals[t.Category or "Uncategorised"] = totals.get(t.Category or "Uncategorised", 0.0) + t.Amount
    total = sum(totals.values())
    ranked = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)

    top = ranked[:3]
    findings.append(
        Finding(
            agent="spending",
            severity="info",
            title="Where your money goes",
            detail=(
                f"Over the last {ctx.months} months your largest categories were "
                + ", ".join(f"{name} ({_pct(amt / total)})" for name, amt in top)
                + "."
            ),
            evidence=[f"{name}: {_kes(amt)} ({_pct(amt / total)})" for name, amt in ranked[:6]],
            metrics={
                "totalOutflow": round(total, 2),
                "byCategory": {k: round(v, 2) for k, v in ranked},
            },
        )
    )

    discretionary = {
        name: amt for name, amt in totals.items()
        if name.split("/")[0].strip().lower() not in ESSENTIAL_CATEGORIES
        and "invest" not in name.lower() and "save" not in name.lower()
    }
    disc_total = sum(discretionary.values())
    disc_share = disc_total / total if total else 0.0

    if disc_share > 0.25 and disc_total > 0:
        monthly_disc = disc_total / ctx.months
        trim = monthly_disc * 0.2
        findings.append(
            Finding(
                agent="spending",
                severity="medium",
                title="Discretionary spending has room to trim",
                detail=(
                    f"{_pct(disc_share)} of your outflow is discretionary — about "
                    f"{_kes(monthly_disc)} a month. Trimming a fifth of it frees "
                    f"{_kes(trim)} a month without touching essentials."
                ),
                evidence=[f"{name}: {_kes(amt / ctx.months)}/mo" for name, amt in
                          sorted(discretionary.items(), key=lambda kv: kv[1], reverse=True)[:4]],
                metrics={"discretionaryShare": round(disc_share, 4), "monthlyDiscretionary": round(monthly_disc, 2)},
            )
        )
        actions.append(
            Action(
                title=f"Redirect {_kes(trim)} a month from discretionary spending",
                rationale="A 20% trim on non-essential categories, which historically does not disrupt a household.",
                amount=trim,
                cadence="monthly",
                instrument="mmf",
                priority=3,
                assumptions=["Category labels on your transactions are accurate.",
                             "Essential categories were excluded from the trim."],
            )
        )

    return findings, actions


def cashflow_agent(ctx: AdvisorContext) -> tuple[list[Finding], list[Action]]:
    """Judge whether income reliably exceeds spending, and how steady it is."""
    findings: list[Finding] = []
    income, expenses = ctx.monthly_income, ctx.monthly_expenses

    if income <= 0:
        return [Finding("cashflow", "high", "No income recorded",
                        "Add your income transactions so savings and investment capacity can be calculated.")], []

    surplus = income - expenses
    savings_rate = surplus / income

    volatility = 0.0
    if len(ctx.cashflow_months) >= 3:
        inflows = [c.Inflow for c in ctx.cashflow_months]
        mean = statistics.fmean(inflows)
        if mean > 0:
            volatility = statistics.pstdev(inflows) / mean

    if surplus <= 0:
        severity, title = "critical", "You are spending more than you earn"
        detail = (f"Average income is {_kes(income)} against {_kes(expenses)} of spending — "
                  f"a shortfall of {_kes(abs(surplus))} a month. Close this before investing anything.")
    elif savings_rate < 0.10:
        severity, title = "high", "Savings rate is thin"
        detail = (f"You keep {_pct(savings_rate)} of income ({_kes(surplus)} a month). "
                  "Under 10% leaves little room when something unexpected lands.")
    elif savings_rate < 0.20:
        severity, title = "medium", "Savings rate is workable"
        detail = (f"You keep {_pct(savings_rate)} of income ({_kes(surplus)} a month). "
                  "Pushing toward 20% would visibly speed up your goals.")
    else:
        severity, title = "info", "Strong savings rate"
        detail = (f"You keep {_pct(savings_rate)} of income ({_kes(surplus)} a month) — "
                  "well placed to fund goals and invest.")

    findings.append(
        Finding(
            agent="cashflow", severity=severity, title=title, detail=detail,
            evidence=[f"Average monthly income: {_kes(income)}",
                      f"Average monthly spending: {_kes(expenses)}",
                      f"Monthly surplus: {_kes(surplus)}"],
            metrics={"monthlyIncome": round(income, 2), "monthlyExpenses": round(expenses, 2),
                     "monthlySurplus": round(surplus, 2), "savingsRate": round(savings_rate, 4)},
        )
    )

    if volatility > 0.20:
        findings.append(
            Finding(
                agent="cashflow", severity="medium", title="Income varies month to month",
                detail=(f"Your income swings about {_pct(volatility)} around its average. "
                        "Hold a deeper buffer than a salaried earner would, and favour instruments you can exit quickly."),
                evidence=[f"Income volatility: {_pct(volatility)}",
                          f"Range: {_kes(min(c.Inflow for c in ctx.cashflow_months))} – "
                          f"{_kes(max(c.Inflow for c in ctx.cashflow_months))}"],
                metrics={"incomeVolatility": round(volatility, 4)},
            )
        )

    return findings, []


def emergency_fund_agent(ctx: AdvisorContext) -> tuple[list[Finding], list[Action]]:
    """Size the emergency fund against real spending, not a round number."""
    expenses = ctx.monthly_expenses
    if expenses <= 0:
        return [], []

    # Irregular income needs a deeper buffer than a steady salary.
    months_target = ctx.emergency_months_target
    if len(ctx.cashflow_months) >= 3:
        inflows = [c.Inflow for c in ctx.cashflow_months]
        mean = statistics.fmean(inflows)
        if mean > 0 and statistics.pstdev(inflows) / mean > 0.20:
            months_target = max(months_target, 6)

    target = expenses * months_target
    cover = ctx.emergency_cover
    gap = max(0.0, target - cover)
    months_covered = cover / expenses if expenses else 0.0
    surplus = max(0.0, ctx.monthly_income - expenses)

    if gap <= 0:
        finding = Finding(
            agent="emergency", severity="info", title="Emergency fund is fully funded",
            detail=(f"You hold {_kes(cover)} — about {months_covered:.1f} months of spending, at or above your "
                    f"{months_target}-month target. Surplus beyond this can go to longer-horizon growth."),
            evidence=[f"Monthly spending: {_kes(expenses)}", f"Target ({months_target} months): {_kes(target)}",
                      f"Reachable within a day: {_kes(cover)}"],
            metrics={"target": round(target, 2), "current": round(cover, 2), "gap": 0.0,
                     "monthsCovered": round(months_covered, 2), "monthsTarget": months_target},
        )
        return [finding], []

    severity = "critical" if months_covered < 1 else "high" if months_covered < 2 else "medium"
    # Close the gap over a year, but never propose more than the surplus can carry.
    monthly_plan = min(gap / 12, surplus * 0.6) if surplus > 0 else gap / 12
    eta = gap / monthly_plan if monthly_plan > 0 else 0

    finding = Finding(
        agent="emergency", severity=severity, title=f"Emergency fund covers {months_covered:.1f} months",
        detail=(f"Your spending averages {_kes(expenses)} a month, so a {months_target}-month buffer is "
                f"{_kes(target)}. You hold {_kes(cover)}, leaving a gap of {_kes(gap)}. "
                "This is the first thing to close — it is what stops a bad month becoming expensive debt."),
        evidence=[f"Monthly spending: {_kes(expenses)}",
                  f"Target ({months_target} months): {_kes(target)}",
                  f"Reachable within a day: {_kes(cover)}",
                  f"Gap: {_kes(gap)}"],
        metrics={"target": round(target, 2), "current": round(cover, 2), "gap": round(gap, 2),
                 "monthsCovered": round(months_covered, 2), "monthsTarget": months_target,
                 "monthlyPlan": round(monthly_plan, 2)},
    )

    action = Action(
        title=f"Put {_kes(monthly_plan)} a month into a money market fund",
        rationale=(f"Closes your {_kes(gap)} emergency gap in about {eta:.0f} months while staying withdrawable "
                   "within a day. Keep this separate from your spending account."),
        amount=monthly_plan, cadence="monthly", instrument="mmf", priority=1,
        assumptions=[f"Spending stays near {_kes(expenses)} a month.",
                     "MMF yields are variable and not guaranteed.",
                     "Buffer is held in cash-equivalents, not locked products."],
    )
    return [finding], [action]


def debt_agent(ctx: AdvisorContext) -> tuple[list[Finding], list[Action]]:
    """Weigh debt service against income and pick the payoff order."""
    if not ctx.liabilities:
        return [], []

    total = sum(l.Balance for l in ctx.liabilities)
    service = sum(l.MonthlyPayment for l in ctx.liabilities)
    income = ctx.monthly_income
    if total <= 0 or income <= 0:
        return [], []

    burden = service / income
    severity = "critical" if burden > 0.40 else "high" if burden > 0.30 else "medium" if burden > 0.15 else "info"

    findings = [
        Finding(
            agent="debt",
            severity=severity,
            title=f"Debt service takes {_pct(burden)} of income",
            detail=(f"You owe {_kes(total)} across {len(ctx.liabilities)} facilities, costing {_kes(service)} a month."
                    + (" Above 30% this crowds out saving — clear the expensive debt before investing."
                       if burden > 0.30 else " That is a manageable load.")),
            evidence=[f"{l.Name} ({l.Lender}): {_kes(l.Balance)}"
                      + (f" at {l.InterestRate:.1f}%" if l.InterestRate else "")
                      for l in sorted(ctx.liabilities, key=lambda x: x.InterestRate or 0, reverse=True)],
            metrics={"totalDebt": round(total, 2), "monthlyService": round(service, 2),
                     "debtBurdenRatio": round(burden, 4)},
        )
    ]

    actions: list[Action] = []
    # Anything dearer than a low-risk fund returns is better repaid than invested.
    expensive = [l for l in ctx.liabilities if (l.InterestRate or 0) >= 12]
    if expensive:
        worst = max(expensive, key=lambda l: l.InterestRate or 0)
        actions.append(
            Action(
                title=f"Clear {worst.Name} before adding investment risk",
                rationale=(f"It carries {worst.InterestRate:.1f}% interest. Repaying it is a guaranteed return at that "
                           "rate — better than any low-risk fund can promise."),
                amount=worst.Balance, instrument=None, priority=2,
                assumptions=["Interest rate is as recorded on the liability.",
                             "No early-settlement penalty applies."],
            )
        )
    return findings, actions


def allocation_agent(ctx: AdvisorContext) -> tuple[list[Finding], list[Action]]:
    """Split investable surplus across instruments, buffer first."""
    income, expenses = ctx.monthly_income, ctx.monthly_expenses
    surplus = income - expenses
    if surplus <= 0:
        return [], []

    upcoming = sum(o.Amount for o in ctx.obligations if o.Status in ("upcoming", "overdue"))
    gap = max(0.0, ctx.monthly_expenses * ctx.emergency_months_target - ctx.emergency_cover)

    # Goal top-ups already claim part of the surplus, so investing that money
    # again would hand the user a plan they cannot actually fund.
    goal_claims = _goal_monthly_claims(ctx)

    # Obligations, goal commitments, and the buffer are all claimed first.
    investable = max(0.0, surplus - (upcoming / max(ctx.months, 1)) - goal_claims)
    if gap > 0:
        investable *= 0.4  # most of what remains keeps going to the buffer

    if investable < 500:
        return [
            Finding(
                agent="allocation", severity="info", title="Investable surplus is small for now",
                detail=("After obligations and your emergency buffer, little is free to invest this month. "
                        "Close the buffer gap first — that is the higher-value move."),
                metrics={"investable": round(investable, 2), "emergencyGap": round(gap, 2)},
            )
        ], []

    tolerance, horizon = ctx.tolerance, ctx.horizon
    if tolerance == "low" or horizon == "short":
        weights = {"mmf": 0.50, "tbill": 0.30, "sacco": 0.20}
        stance = "capital preservation"
    elif tolerance in ("elevated", "high") and horizon == "long":
        weights = {"mmf": 0.20, "sacco": 0.15, "tbond": 0.30, "nse": 0.35}
        stance = "growth"
    elif horizon == "long":
        weights = {"mmf": 0.25, "sacco": 0.20, "tbill": 0.15, "tbond": 0.25, "nse": 0.15}
        stance = "balanced growth"
    else:
        weights = {"mmf": 0.35, "sacco": 0.25, "tbill": 0.25, "tbond": 0.15}
        stance = "balanced"

    split = {k: investable * w for k, w in weights.items()}

    findings = [
        Finding(
            agent="allocation", severity="info",
            title=f"About {_kes(investable)} a month is investable",
            detail=(f"With a {horizon}-term horizon and {tolerance} risk tolerance, a {stance} split fits. "
                    "Percentages are a starting frame, not a fixed rule."),
            evidence=[f"{INSTRUMENT_GUIDE[k]['label']}: {_kes(v)}/mo ({_pct(weights[k])})"
                      for k, v in split.items()],
            metrics={"investable": round(investable, 2), "stance": stance,
                     "weights": weights, "split": {k: round(v, 2) for k, v in split.items()}},
        )
    ]

    actions = [
        Action(
            title=f"Direct {_kes(amount)} a month to {INSTRUMENT_GUIDE[key]['label']}",
            rationale=INSTRUMENT_GUIDE[key]["use"],
            amount=amount, cadence="monthly", instrument=key,
            priority=4 if key in ("mmf", "sacco") else 5,
            assumptions=["Split reflects your recorded risk profile — update it if it has changed.",
                         "Yields shown in Market Intelligence are illustrative, not guaranteed.",
                         "Emergency buffer is funded before higher-risk allocations grow."],
        )
        for key, amount in sorted(split.items(), key=lambda kv: kv[1], reverse=True)
        if amount >= 250
    ]
    return findings, actions


def _goal_monthly_claims(ctx: AdvisorContext) -> float:
    """Monthly top-ups the goal agent will ask for, so allocation can net them off."""
    now = datetime.now(timezone.utc)
    claimed = 0.0
    for goal in ctx.goals:
        remaining = max(0.0, goal.Target - goal.Current)
        if remaining <= 0 or not goal.Deadline:
            continue
        months_left = max(1, round((goal.Deadline - now).days / 30))
        shortfall = (remaining / months_left) - (goal.MonthlyContribution or 0)
        if shortfall > 1:
            claimed += shortfall
    return claimed


def goal_agent(ctx: AdvisorContext) -> tuple[list[Finding], list[Action]]:
    """Check whether goal contributions actually meet their deadlines."""
    findings: list[Finding] = []
    actions: list[Action] = []
    now = datetime.now(timezone.utc)

    for goal in sorted(ctx.goals, key=lambda g: g.Priority):
        remaining = max(0.0, goal.Target - goal.Current)
        if remaining <= 0:
            continue
        if not goal.Deadline:
            continue
        months_left = max(1, round((goal.Deadline - now).days / 30))
        needed = remaining / months_left
        shortfall = needed - (goal.MonthlyContribution or 0)

        if shortfall > 1:
            findings.append(
                Finding(
                    agent="goals", severity="medium",
                    title=f"“{goal.Name}” is behind its deadline",
                    detail=(f"{_kes(remaining)} still to raise in about {months_left} months needs "
                            f"{_kes(needed)} a month; you are putting in {_kes(goal.MonthlyContribution or 0)}. "
                            f"Either add {_kes(shortfall)} a month or move the date."),
                    evidence=[f"Target: {_kes(goal.Target)}", f"Saved: {_kes(goal.Current)}",
                              f"Deadline: {goal.Deadline.date()}"],
                    metrics={"goalId": goal.Id, "remaining": round(remaining, 2),
                             "monthsLeft": months_left, "requiredMonthly": round(needed, 2),
                             "shortfall": round(shortfall, 2)},
                )
            )
            actions.append(
                Action(
                    title=f"Add {_kes(shortfall)} a month toward {goal.Name}",
                    rationale=f"Keeps the {goal.Deadline.date()} deadline realistic at the current target.",
                    amount=shortfall, cadence="monthly",
                    instrument="mmf" if months_left <= 18 else "tbond",
                    priority=2 if goal.Priority <= 1 else 4,
                    assumptions=["Deadline and target are current.",
                                 "Short-horizon goals stay in liquid instruments."],
                )
            )
    return findings, actions


AGENTS: list[tuple[str, Callable[[AdvisorContext], tuple[list[Finding], list[Action]]]]] = [
    ("cashflow", cashflow_agent),
    ("spending", spending_agent),
    ("emergency", emergency_fund_agent),
    ("debt", debt_agent),
    ("goals", goal_agent),
    ("allocation", allocation_agent),
]


@dataclass
class AdvisorReport:
    entity_id: str
    generated_at: datetime
    headline: str
    summary: str
    findings: list[Finding]
    actions: list[Action]
    metrics: dict[str, Any]

    def as_dict(self) -> dict[str, Any]:
        return {
            "entityId": self.entity_id,
            "generatedAt": self.generated_at.isoformat().replace("+00:00", "Z"),
            "headline": self.headline,
            "summary": self.summary,
            "findings": [f.as_dict() for f in self.findings],
            "actions": [a.as_dict() for a in self.actions],
            "metrics": self.metrics,
            "agents": [name for name, _ in AGENTS],
            "disclaimer": (
                "Generated from your own recorded transactions and balances. This is planning "
                "guidance, not regulated financial advice, and no returns are guaranteed."
            ),
        }


def _synthesize(ctx: AdvisorContext, findings: list[Finding], actions: list[Action]) -> tuple[str, str]:
    """Lead with the most urgent thing, then say what the plan adds up to."""
    worst = min(findings, key=lambda f: SEVERITY_ORDER.get(f.severity, 9), default=None)
    income, expenses = ctx.monthly_income, ctx.monthly_expenses
    surplus = income - expenses

    if worst is None:
        return "Not enough history to advise yet", (
            "Add or connect a few months of transactions and the agents can size your buffer and allocation."
        )

    headline = worst.title
    committed = sum(a.amount or 0 for a in actions if a.cadence == "monthly")
    parts = [
        f"Across {ctx.months} months you average {_kes(income)} in and {_kes(expenses)} out, "
        f"leaving {_kes(max(0.0, surplus))} a month."
    ]
    if committed > 0:
        if committed > surplus > 0:
            # Say so rather than implying the whole plan is affordable today.
            parts.append(
                f"The steps below add up to {_kes(committed)} a month — more than your surplus covers, "
                "so work down the list in order and stop where the money runs out."
            )
        else:
            parts.append(f"The plan below puts {_kes(committed)} of that to work each month.")
    critical = [f for f in findings if f.severity in ("critical", "high")]
    if critical:
        parts.append(f"{len(critical)} item{'s' if len(critical) > 1 else ''} need attention first.")
    return headline, " ".join(parts)


def run_advisors(ctx: AdvisorContext) -> AdvisorReport:
    findings: list[Finding] = []
    actions: list[Action] = []

    for _, agent in AGENTS:
        try:
            f, a = agent(ctx)
        except Exception:  # one agent failing must not sink the report
            continue
        findings.extend(f)
        actions.extend(a)

    findings.sort(key=lambda f: SEVERITY_ORDER.get(f.severity, 9))
    actions.sort(key=lambda a: (a.priority, -(a.amount or 0)))

    headline, summary = _synthesize(ctx, findings, actions)

    return AdvisorReport(
        entity_id=ctx.entity.Id,
        generated_at=datetime.now(timezone.utc),
        headline=headline,
        summary=summary,
        findings=findings,
        actions=actions,
        metrics={
            "monthlyIncome": round(ctx.monthly_income, 2),
            "monthlyExpenses": round(ctx.monthly_expenses, 2),
            "monthlySurplus": round(ctx.monthly_income - ctx.monthly_expenses, 2),
            "liquid": round(ctx.liquid, 2),
            "emergencyCover": round(ctx.emergency_cover, 2),
            "emergencyTarget": round(ctx.monthly_expenses * ctx.emergency_months_target, 2),
            "monthsAnalysed": ctx.months,
            "transactionsAnalysed": len(ctx.recent),
        },
    )
