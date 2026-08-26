"""Give a brand-new account a working set of opening books.

Signing up used to create one empty PERSONAL entity, which left every Wealth,
Intelligence, and Orchestration tab blank — there is nothing to analyse without
accounts, transactions, or goals.

New users start with a realistic Kenyan household and side business as their
*opening balances*: every row is editable, and everything here is marked
``user_entered`` rather than ``demo``, because it belongs to the user and is
meant to be corrected to their real figures. Valuations the platform cannot
know exactly (household goods, stock on hand) stay ``estimated``.

``DELETE /api/entities/{id}/books`` clears the lot for anyone who would rather
start from an empty ledger.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app import models

OPENING = "user_entered"
ESTIMATED = "estimated"


def _months_back(n: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=30 * n)


def _day(offset: int) -> datetime:
    """A datetime `offset` days before now, floored to the hour."""
    return (datetime.now(timezone.utc) - timedelta(days=offset)).replace(
        minute=0, second=0, microsecond=0
    )


def provision_starter_workspace(db: Session, user: models.User) -> models.Entity:
    """Create Personal + Business entities with starter data. Returns the personal one."""
    now = datetime.now(timezone.utc)

    personal = models.Entity(
        UserId=user.Id,
        Type="PERSONAL",
        Name="Personal",
        Description="Household cash, savings, investments, and family goals",
    )
    business = models.Entity(
        UserId=user.Id,
        Type="BUSINESS",
        Name="Business",
        Description="Side business — receivables, suppliers, and operating cash",
    )
    db.add_all([personal, business])
    db.flush()

    mpesa = models.Account(
        EntityId=personal.Id, Name="M-Pesa", Provider="mpesa", Institution="Safaricom",
        Balance=18400, ConnectionStatus="manual", Provenance=OPENING, AccountMask="••• 7742",
        IsLiquid=True, LastUpdated=now, Channel="MPESA",
    )
    bank = models.Account(
        EntityId=personal.Id, Name="Bank current account", Provider="bank", Institution="Equity Bank",
        Balance=52600, ConnectionStatus="manual", Provenance="user_entered", AccountMask="••• 1180",
        IsLiquid=True, LastUpdated=now,
    )
    sacco = models.Account(
        EntityId=personal.Id, Name="SACCO deposits", Provider="sacco", Institution="Stima SACCO",
        Balance=64000, ConnectionStatus="manual", Provenance="user_entered",
        IsLiquid=False, LastUpdated=now,
    )
    biz_bank = models.Account(
        EntityId=business.Id, Name="Business account", Provider="bank", Institution="KCB",
        Balance=96500, ConnectionStatus="manual", Provenance="user_entered", AccountMask="••• 4402",
        IsLiquid=True, LastUpdated=now,
    )
    biz_till = models.Account(
        EntityId=business.Id, Name="Till float", Provider="mpesa", Institution="Safaricom",
        Balance=23800, ConnectionStatus="manual", Provenance=OPENING,
        IsLiquid=True, LastUpdated=now, Channel="MPESA",
    )
    db.add_all([mpesa, bank, sacco, biz_bank, biz_till])
    db.flush()

    db.add_all(
        [
            models.Transaction(EntityId=personal.Id, AccountId=bank.Id, Date=_day(26), Description="Salary", Amount=120000, Category="Income", Type="inflow", Provenance=OPENING),
            models.Transaction(EntityId=personal.Id, AccountId=mpesa.Id, Date=_day(24), Description="Rent", Amount=32000, Category="Housing", Type="outflow", Provenance=OPENING),
            models.Transaction(EntityId=personal.Id, AccountId=mpesa.Id, Date=_day(21), Description="Groceries", Amount=9800, Category="Food", Type="outflow", Provenance=OPENING),
            models.Transaction(EntityId=personal.Id, AccountId=mpesa.Id, Date=_day(18), Description="Transport & fuel", Amount=7200, Category="Transport", Type="outflow", Provenance=OPENING),
            models.Transaction(EntityId=personal.Id, AccountId=bank.Id, Date=_day(15), Description="MMF contribution", Amount=12000, Category="Invest / Save", Type="outflow", Provenance=OPENING),
            models.Transaction(EntityId=personal.Id, AccountId=bank.Id, Date=_day(12), Description="SACCO contribution", Amount=8000, Category="Invest / Save", Type="outflow", Provenance=OPENING),
            models.Transaction(EntityId=personal.Id, AccountId=mpesa.Id, Date=_day(8), Description="Airtime & data", Amount=2400, Category="Utilities", Type="outflow", Provenance=OPENING),
            models.Transaction(EntityId=personal.Id, AccountId=mpesa.Id, Date=_day(4), Description="Family support", Amount=6000, Category="Family", Type="outflow", Provenance=OPENING),
            models.Transaction(EntityId=business.Id, AccountId=biz_bank.Id, Date=_day(20), Description="Client invoice paid", Amount=64000, Category="Receivables", Type="inflow", Provenance=OPENING),
            models.Transaction(EntityId=business.Id, AccountId=biz_till.Id, Date=_day(16), Description="Till sales", Amount=38500, Category="Sales", Type="inflow", Provenance=OPENING),
            models.Transaction(EntityId=business.Id, AccountId=biz_bank.Id, Date=_day(11), Description="Supplier restock", Amount=27000, Category="Suppliers", Type="outflow", Provenance=OPENING),
            models.Transaction(EntityId=business.Id, AccountId=biz_bank.Id, Date=_day(6), Description="Shop rent", Amount=18000, Category="Overheads", Type="outflow", Provenance=OPENING),
        ]
    )

    db.add_all(
        [
            models.Asset(EntityId=personal.Id, Name="Laptop & electronics", Category="Electronics", Value=95000, Liquidity="illiquid", Provenance=ESTIMATED),
            models.Asset(EntityId=personal.Id, Name="Household goods", Category="Home", Value=140000, Liquidity="illiquid", Provenance=ESTIMATED),
            models.Asset(EntityId=business.Id, Name="Stock on hand", Category="Inventory", Value=118000, Liquidity="semi_liquid", Provenance=ESTIMATED),
            models.Asset(EntityId=business.Id, Name="Equipment", Category="Equipment", Value=72000, Liquidity="illiquid", Provenance=ESTIMATED),
        ]
    )

    db.add_all(
        [
            models.Investment(EntityId=personal.Id, Name="Money market fund", Type="mmf", Value=86000, CostBasis=80000, Liquidity="daily", Risk="low", Provenance=OPENING, Notes="Opening balance — replace with your own fund", LastUpdated=now),
            models.Investment(EntityId=personal.Id, Name="91-day Treasury Bill", Type="tbill", Value=50000, CostBasis=47800, Liquidity="maturity", Risk="low", Provenance=OPENING, LastUpdated=now),
            models.Investment(EntityId=personal.Id, Name="SACCO shares", Type="sacco", Value=35000, Liquidity="locked", Risk="moderate", Provenance="user_entered", LastUpdated=now),
            models.Investment(EntityId=business.Id, Name="Business reserve MMF", Type="mmf", Value=42000, Liquidity="daily", Risk="low", Provenance=OPENING, Notes="Operating reserve", LastUpdated=now),
        ]
    )

    db.add_all(
        [
            models.Liability(EntityId=personal.Id, Name="Mobile credit facility", Lender="Safaricom", Balance=3500, MonthlyPayment=3500, Provenance=OPENING, LastUpdated=now),
            models.Liability(EntityId=personal.Id, Name="Phone financing", Lender="Bank", Balance=21000, MonthlyPayment=3800, InterestRate=13.0, DueDay=5, Provenance="user_entered", LastUpdated=now),
            models.Liability(EntityId=business.Id, Name="Stock financing", Lender="KCB", Balance=85000, MonthlyPayment=11500, InterestRate=14.0, DueDay=28, Provenance="user_entered", LastUpdated=now),
        ]
    )

    db.add_all(
        [
            models.Obligation(EntityId=personal.Id, Name="Next month rent", Amount=32000, DueDate=now + timedelta(days=14), Category="Housing", Status="upcoming"),
            models.Obligation(EntityId=personal.Id, Name="Utilities", Amount=4500, DueDate=now + timedelta(days=9), Category="Utilities", Status="upcoming"),
            models.Obligation(EntityId=business.Id, Name="Supplier invoice", Amount=27000, DueDate=now + timedelta(days=11), Category="Suppliers", Status="upcoming"),
        ]
    )

    emergency = models.Goal(EntityId=personal.Id, Name="Emergency Fund", Category="emergency", Target=250000, Current=64000, Deadline=now + timedelta(days=365), MonthlyContribution=15000, Priority=1)
    db.add_all(
        [
            emergency,
            models.Goal(EntityId=personal.Id, Name="Further studies", Category="education", Target=300000, Current=42000, Deadline=now + timedelta(days=540), MonthlyContribution=12000, Priority=2),
            models.Goal(EntityId=personal.Id, Name="Land deposit", Category="property", Target=900000, Current=85000, Deadline=now + timedelta(days=900), MonthlyContribution=20000, Priority=3),
            models.Goal(EntityId=business.Id, Name="Expand stock lines", Category="business", Target=400000, Current=96000, Deadline=now + timedelta(days=450), MonthlyContribution=25000, Priority=1),
        ]
    )
    db.flush()

    db.add_all(
        [
            models.RiskProfile(EntityId=personal.Id, Horizon="medium", Tolerance="moderate", EmergencyFundMonthsTarget=3, Notes="Balanced — liquidity first, then growth"),
            models.RiskProfile(EntityId=business.Id, Horizon="short", Tolerance="low", EmergencyFundMonthsTarget=2, Notes="Protect operating runway"),
            models.SurplusConfig(EntityId=personal.Id, EmergencyBufferOverride=45000, DiscretionarySpendRatio=1.0 / 3),
            models.SurplusConfig(EntityId=business.Id, EmergencyBufferOverride=35000, DiscretionarySpendRatio=0.3),
        ]
    )

    db.add_all(
        [
            models.CreditReadiness(
                EntityId=personal.Id, Level="GOOD", IncomeMonthly=120000, ExpensesMonthly=77400,
                MonthlySurplus=42600, LiquidAssets=71000, Investments=171000, Liabilities=24500,
                DebtBurdenRatio=0.06, SavingsConsistency=68, HistoryMonths=6,
                NotesJson=[
                    "Regular monthly income detected in your starter history.",
                    "Debt service is comfortably below income.",
                    "Emergency fund is still short of target — closing it lifts readiness.",
                ],
                Disclaimer="Financial readiness for your own planning. Not a CRB score, bank underwriting decision, or loan offer.",
                LastUpdated=now,
            ),
            models.CreditReadiness(
                EntityId=business.Id, Level="FAIR", IncomeMonthly=102500, ExpensesMonthly=45000,
                MonthlySurplus=57500, LiquidAssets=120300, Investments=42000, Liabilities=85000,
                DebtBurdenRatio=0.11, SavingsConsistency=52, HistoryMonths=6,
                NotesJson=[
                    "Revenue is concentrated in a small number of clients.",
                    "Stock financing raises leverage.",
                    "Readiness improves with 12 months of documented statements.",
                ],
                Disclaimer="Business financial readiness indicator for planning — not credit approval.",
                LastUpdated=now,
            ),
        ]
    )

    personal_cf = [(120000.0, 96000.0), (120000.0, 88000.0), (126000.0, 91000.0), (120000.0, 84000.0), (120000.0, 79000.0), (120000.0, 77400.0)]
    business_cf = [(78000.0, 52000.0), (86000.0, 61000.0), (94000.0, 48000.0), (88000.0, 57000.0), (110000.0, 63000.0), (102500.0, 45000.0)]
    for entity, series in ((personal, personal_cf), (business, business_cf)):
        for i, (inflow, outflow) in enumerate(series):
            month_date = _months_back(len(series) - 1 - i)
            db.add(
                models.CashflowMonth(
                    EntityId=entity.Id,
                    Month=month_date.strftime("%b"),
                    Year=month_date.year,
                    SortOrder=i + 1,
                    Inflow=inflow,
                    Outflow=outflow,
                )
            )

    db.add_all(
        [
            models.AutomationRule(
                EntityId=personal.Id,
                Name="Payday surplus sweep",
                Description="When income lands, check obligations, protect the emergency buffer, then propose moving safe surplus to your Emergency Fund.",
                Status="awaiting_authorization",
                Trigger="Income detected ≥ KES 50,000",
                Action="Propose transfer to Emergency Fund (your approval required)",
                ActionType="send_money",
                TargetGoalId=emergency.Id,
                TriggerSpec={"kind": "income_detected", "threshold": 50000, "amount_min": 200},
                ActionSpec={
                    "op": "send_money",
                    "amount_rule": "safe_surplus",
                    "target_goal_id": emergency.Id,
                    "recipient_mobile_no": "254700000000",
                },
                AutoApprove=False,
            ),
            models.AutomationRule(
                EntityId=business.Id,
                Name="Supplier buffer guard",
                Description="Keep one month of supplier obligations liquid before any investment sweep.",
                Status="coming_soon",
                Trigger="Weekly cash-flow review",
                Action="Block sweep if buffer breached",
                TriggerSpec={"kind": "weekly_recon"},
                ActionSpec={"op": "guard"},
                AutoApprove=True,
            ),
        ]
    )

    db.add_all(
        [
            models.ActivityEvent(EntityId=personal.Id, Timestamp=now, Title="Workspace created", Detail="Opening balances added so every surface has something to work with. Edit or clear them any time.", Kind="system"),
            models.ActivityEvent(EntityId=personal.Id, Timestamp=now, Title="Surplus calculated", Detail="Safe-to-spend and safe-to-invest derived from your starter balances.", Kind="analysis"),
            models.ActivityEvent(EntityId=business.Id, Timestamp=now, Title="Business books opened", Detail="Receivables, suppliers, and operating cash initialised.", Kind="system"),
        ]
    )

    supplier = models.Supplier(
        EntityId=business.Id, Name="Main supplier", TrustScore=78, PaybillOrTill="888880",
        PaymentHistory={"onTimePayments": 11, "latePayments": 2, "averageDays": 6},
    )
    db.add(supplier)
    db.flush()
    db.add(
        models.BnplAgreement(
            SupplierId=supplier.Id, Principal=80000, Balance=30000, Status="active",
            InstallmentSchedule=[
                {"dueDate": (now + timedelta(days=15)).date().isoformat(), "amount": 15000, "status": "upcoming"},
                {"dueDate": (now + timedelta(days=45)).date().isoformat(), "amount": 15000, "status": "upcoming"},
            ],
        )
    )

    db.add_all(
        [
            models.ProfileMember(EntityId=personal.Id, UserId=user.Id, Role="owner", JoinedAt=now),
            models.ProfileMember(EntityId=business.Id, UserId=user.Id, Role="owner", JoinedAt=now),
        ]
    )

    db.commit()
    db.refresh(personal)
    return personal
