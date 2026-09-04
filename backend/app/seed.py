from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app import models
from app.auth import hash_password, hash_pin
from app.db import SessionLocal, init_db

AS_OF = datetime(2026, 8, 13, 17, 40, 0, tzinfo=timezone.utc)


def _dt(y: int, m: int, d: int, h: int = 0, mi: int = 0) -> datetime:
    return datetime(y, m, d, h, mi, 0, tzinfo=timezone.utc)


def seed(db: Session) -> None:
    for model in (
        models.BnplAgreement,
        models.Supplier,
        models.Recommendation,
        models.ProfileMember,
        models.BusinessProfileDetails,
        models.ActivityEvent,
        models.RuleRun,
        models.AutomationRule,
        models.CashflowMonth,
        models.SurplusConfig,
        models.CreditReadiness,
        models.RiskProfile,
        models.Goal,
        models.Obligation,
        models.Liability,
        models.Investment,
        models.Asset,
        models.Transaction,
        models.Account,
        models.Entity,
        models.User,
        models.MarketInstrument,
        models.Provider,
    ):
        db.query(model).delete()
    db.commit()

    user = models.User(
        Id="user-amina",
        Name="Amina Otieno",
        Email="amina@example.com",
        Phone="+254 712 000 000",
        Location="Nairobi, Kenya",
        PasswordHash=hash_password("demo1234"),
        PinHash=hash_pin("1234"),
    )
    db.add(user)

    personal = models.Entity(
        Id="ent-personal",
        UserId=user.Id,
        Type="PERSONAL",
        Name="Personal",
        Description="Household cash, savings, investments, and family goals",
    )
    business = models.Entity(
        Id="ent-business",
        UserId=user.Id,
        Type="BUSINESS",
        Name="Business",
        Description="Studio Kitenge — inventory, receivables, and operating cash",
    )
    db.add_all([personal, business])
    db.flush()

    db.add_all(
        [
            models.Account(Id="acc-mpesa", EntityId=personal.Id, Name="M-Pesa", Provider="mpesa", Institution="Safaricom", Balance=24500, ConnectionStatus="demo", Provenance="demo", AccountMask="••• 4481", IsLiquid=True, LastUpdated=AS_OF),
            models.Account(Id="acc-equity", EntityId=personal.Id, Name="Equity Current", Provider="bank", Institution="Equity Bank", Balance=48200, ConnectionStatus="manual", Provenance="user_entered", AccountMask="••• 9021", IsLiquid=True, LastUpdated=_dt(2026, 8, 12, 9)),
            models.Account(Id="acc-cash", EntityId=personal.Id, Name="Cash on hand", Provider="cash", Institution="Self", Balance=12300, ConnectionStatus="manual", Provenance="user_entered", IsLiquid=True, LastUpdated=_dt(2026, 8, 13, 8)),
            models.Account(Id="acc-sacco", EntityId=personal.Id, Name="Workplace SACCO", Provider="sacco", Institution="Umoja SACCO", Balance=95000, ConnectionStatus="manual", Provenance="user_entered", IsLiquid=False, LastUpdated=_dt(2026, 8, 1, 12)),
            models.Account(Id="acc-biz-kcb", EntityId=business.Id, Name="KCB Business", Provider="bank", Institution="KCB", Balance=186400, ConnectionStatus="manual", Provenance="user_entered", AccountMask="••• 3310", IsLiquid=True, LastUpdated=_dt(2026, 8, 13, 10)),
            models.Account(Id="acc-biz-mpesa", EntityId=business.Id, Name="Till / Paybill float", Provider="mpesa", Institution="Safaricom", Balance=42800, ConnectionStatus="demo", Provenance="demo", IsLiquid=True, LastUpdated=AS_OF),
        ]
    )

    db.add_all(
        [
            models.Transaction(Id="tx-1", EntityId=personal.Id, AccountId="acc-equity", Date=_dt(2026, 8, 1), Description="Salary — August", Amount=145000, Category="Income", Type="inflow", Provenance="demo"),
            models.Transaction(Id="tx-2", EntityId=personal.Id, AccountId="acc-mpesa", Date=_dt(2026, 8, 3), Description="Rent — Kilimani", Amount=35000, Category="Housing", Type="outflow", Provenance="demo"),
            models.Transaction(Id="tx-3", EntityId=personal.Id, AccountId="acc-mpesa", Date=_dt(2026, 8, 5), Description="Naivas groceries", Amount=8400, Category="Food", Type="outflow", Provenance="demo"),
            models.Transaction(Id="tx-4", EntityId=personal.Id, AccountId="acc-equity", Date=_dt(2026, 8, 6), Description="MMF top-up — CIC", Amount=15000, Category="Invest / Save", Type="outflow", Provenance="demo"),
            models.Transaction(Id="tx-5", EntityId=personal.Id, AccountId="acc-mpesa", Date=_dt(2026, 8, 8), Description="School fees installment", Amount=12000, Category="Education", Type="outflow", Provenance="demo"),
            models.Transaction(Id="tx-6", EntityId=personal.Id, AccountId="acc-equity", Date=_dt(2026, 8, 10), Description="SACCO contribution", Amount=10000, Category="Invest / Save", Type="outflow", Provenance="user_entered"),
            models.Transaction(Id="tx-7", EntityId=business.Id, AccountId="acc-biz-kcb", Date=_dt(2026, 8, 4), Description="Client payment — fabric order", Amount=78000, Category="Receivables", Type="inflow", Provenance="demo"),
            models.Transaction(Id="tx-8", EntityId=business.Id, AccountId="acc-biz-mpesa", Date=_dt(2026, 8, 7), Description="Supplier — dyes & thread", Amount=22500, Category="Suppliers", Type="outflow", Provenance="demo"),
            models.Transaction(Id="tx-9", EntityId=business.Id, AccountId="acc-biz-kcb", Date=_dt(2026, 8, 11), Description="Workshop rent", Amount=28000, Category="Overheads", Type="outflow", Provenance="demo"),
        ]
    )

    db.add_all(
        [
            models.Asset(Id="ast-laptop", EntityId=personal.Id, Name="Work laptop", Category="Electronics", Value=85000, Liquidity="illiquid", Provenance="estimated"),
            models.Asset(Id="ast-furniture", EntityId=personal.Id, Name="Household goods", Category="Home", Value=120000, Liquidity="illiquid", Provenance="estimated"),
            models.Asset(Id="ast-inventory", EntityId=business.Id, Name="Fabric inventory", Category="Inventory", Value=210000, Liquidity="semi_liquid", Provenance="estimated"),
            models.Asset(Id="ast-equipment", EntityId=business.Id, Name="Sewing machines & tools", Category="Equipment", Value=160000, Liquidity="illiquid", Provenance="estimated"),
            models.Asset(Id="ast-plot", EntityId=personal.Id, Name="Plot — Kitengela (share)", Category="Land", Value=450000, Liquidity="illiquid", Provenance="user_entered"),
            models.Asset(Id="ast-vehicle", EntityId=personal.Id, Name="Toyota Fielder", Category="Vehicle", Value=780000, Liquidity="semi_liquid", Provenance="estimated"),
            models.Asset(Id="ast-receivables", EntityId=business.Id, Name="Outstanding client receivables", Category="Receivables", Value=96000, Liquidity="semi_liquid", Provenance="actual"),
        ]
    )

    db.add_all(
        [
            models.Investment(Id="inv-mmf", EntityId=personal.Id, Name="CIC Money Market Fund", Type="mmf", Value=142000, CostBasis=130000, Liquidity="daily", Risk="low", Provenance="demo", Notes="Demo holding — not a live fund feed", LastUpdated=AS_OF),
            models.Investment(Id="inv-tbill", EntityId=personal.Id, Name="91-day Treasury Bill", Type="tbill", Value=100000, Liquidity="maturity", Risk="low", Provenance="user_entered", Notes="Matures Oct 2026 (user-entered)"),
            models.Investment(Id="inv-sacco-shares", EntityId=personal.Id, Name="SACCO shares", Type="sacco", Value=60000, Liquidity="locked", Risk="moderate", Provenance="user_entered"),
            models.Investment(Id="inv-infra-bond", EntityId=personal.Id, Name="IFB1/2026/17 Infrastructure Bond", Type="infra_bond", Value=55000, CostBasis=50000, Liquidity="maturity", Risk="moderate", Provenance="user_entered", Notes="Tax-free coupon — held to maturity"),
            models.Investment(Id="inv-nse-scom", EntityId=personal.Id, Name="Safaricom PLC (SCOM)", Type="nse", Value=40000, CostBasis=36500, Liquidity="tplus2", Risk="elevated", Provenance="user_entered", Notes="Held via CDSC account"),
            models.Investment(Id="inv-biz-mmf", EntityId=business.Id, Name="Business MMF reserve", Type="mmf", Value=75000, Liquidity="daily", Risk="low", Provenance="demo", Notes="Demo — operating reserve", LastUpdated=AS_OF),
            models.Investment(Id="inv-biz-tbill", EntityId=business.Id, Name="182-day Treasury Bill", Type="tbill", Value=120000, CostBasis=113500, Liquidity="maturity", Risk="low", Provenance="user_entered", Notes="Ladder rung — matures Feb 2027"),
            models.Investment(Id="inv-biz-bond", EntityId=business.Id, Name="FXD1/2026/10 Treasury Bond", Type="tbond", Value=80000, CostBasis=78000, Liquidity="tplus2", Risk="moderate", Provenance="user_entered", Notes="Held for coupon income"),
        ]
    )

    db.add_all(
        [
            models.Liability(Id="liab-fuliza", EntityId=personal.Id, Name="Fuliza / short-term mobile credit", Lender="Safaricom", Balance=4200, MonthlyPayment=4200, Provenance="demo", LastUpdated=AS_OF),
            models.Liability(Id="liab-phone", EntityId=personal.Id, Name="Device financing", Lender="Bank", Balance=28000, MonthlyPayment=4500, InterestRate=13, DueDay=5, Provenance="user_entered"),
            models.Liability(Id="liab-biz-loan", EntityId=business.Id, Name="Working capital loan", Lender="KCB", Balance=180000, MonthlyPayment=18500, InterestRate=14.5, DueDay=28, Provenance="user_entered"),
        ]
    )

    db.add_all(
        [
            models.Obligation(Id="ob-rent", EntityId=personal.Id, Name="September rent", Amount=35000, DueDate=_dt(2026, 9, 1), Category="Housing", Status="upcoming"),
            models.Obligation(Id="ob-school", EntityId=personal.Id, Name="School fees balance", Amount=0, DueDate=_dt(2026, 8, 20), Category="Education", Status="paid"),
            models.Obligation(Id="ob-supplier", EntityId=business.Id, Name="Supplier invoice — cotton", Amount=45000, DueDate=_dt(2026, 8, 20), Category="Suppliers", Status="upcoming"),
            models.Obligation(Id="ob-paye", EntityId=business.Id, Name="PAYE / statutory", Amount=22000, DueDate=_dt(2026, 8, 9), Category="Tax", Status="upcoming"),
            models.Obligation(
                Id="ob-utility",
                EntityId=personal.Id,
                Name="Utility bills — household",
                Amount=9500,
                DueDate=datetime.now(timezone.utc) + timedelta(days=2),
                Category="Utilities",
                Status="upcoming",
            ),
        ]
    )

    db.add_all(
        [
            models.Goal(Id="goal-emergency", EntityId=personal.Id, Name="Emergency Fund", Category="emergency", Target=300000, Current=120000, Deadline=_dt(2026, 12, 31), MonthlyContribution=20000, Priority=1),
            models.Goal(Id="goal-laptop", EntityId=personal.Id, Name="Replacement laptop", Category="purchase", Target=150000, Current=45000, Deadline=_dt(2027, 3, 1), MonthlyContribution=10000, Priority=3),
            models.Goal(Id="goal-land", EntityId=personal.Id, Name="Land deposit", Category="property", Target=800000, Current=95000, Deadline=_dt(2028, 6, 1), MonthlyContribution=25000, Priority=4),
            models.Goal(Id="goal-expansion", EntityId=business.Id, Name="Workshop expansion", Category="business", Target=500000, Current=140000, Deadline=_dt(2027, 6, 1), MonthlyContribution=30000, Priority=1),
        ]
    )
    # AutomationRules reference goals by FK, so goals must exist before they insert.
    db.flush()

    db.add_all(
        [
            models.RiskProfile(EntityId=personal.Id, Horizon="medium", Tolerance="moderate", EmergencyFundMonthsTarget=3, Notes="Prefers liquidity with selective growth"),
            models.RiskProfile(EntityId=business.Id, Horizon="short", Tolerance="low", EmergencyFundMonthsTarget=2, Notes="Protect operating runway first"),
        ]
    )

    db.add_all(
        [
            models.CreditReadiness(
                EntityId=personal.Id,
                Level="GOOD",
                IncomeMonthly=145000,
                ExpensesMonthly=98000,
                MonthlySurplus=47000,
                LiquidAssets=85000,
                Investments=302000,
                Liabilities=32200,
                DebtBurdenRatio=0.06,
                SavingsConsistency=72,
                HistoryMonths=8,
                NotesJson=[
                        "Consistent salary inflow pattern in demo history.",
                        "Debt service is low relative to income.",
                        "Emergency fund still below target — strengthens readiness when closed.",
                    ],
                Disclaimer="Financial readiness for your own planning. Not a CRB score, bank underwriting decision, or loan offer.",
                LastUpdated=AS_OF,
            ),
            models.CreditReadiness(
                EntityId=business.Id,
                Level="FAIR",
                IncomeMonthly=210000,
                ExpensesMonthly=165000,
                MonthlySurplus=45000,
                LiquidAssets=229200,
                Investments=75000,
                Liabilities=180000,
                DebtBurdenRatio=0.09,
                SavingsConsistency=55,
                HistoryMonths=6,
                NotesJson=[
                        "Receivables concentration risk not yet modelled.",
                        "Working capital loan increases leverage.",
                        "Stronger readiness after documenting 12 months of statements.",
                    ],
                Disclaimer="Business financial readiness indicator for planning — not credit approval.",
                LastUpdated=AS_OF,
            ),
        ]
    )

    db.add_all(
        [
            models.SurplusConfig(EntityId=personal.Id, LiquidBalanceOverride=85000, EmergencyBufferOverride=20000, DiscretionarySpendRatio=1.0 / 3, AutomationEnabled=True),
            models.SurplusConfig(EntityId=business.Id, LiquidBalanceOverride=None, EmergencyBufferOverride=40000, DiscretionarySpendRatio=0.3, AutomationEnabled=False),
        ]
    )

    personal_cf = [
        ("Mar", 145000.0, 110000.0, 1),
        ("Apr", 145000.0, 118000.0, 2),
        ("May", 152000.0, 105000.0, 3),
        ("Jun", 145000.0, 122000.0, 4),
        ("Jul", 145000.0, 101000.0, 5),
        ("Aug", 145000.0, 84900.0, 6),
    ]
    business_cf = [
        ("Mar", 180000.0, 160000.0, 1),
        ("Apr", 195000.0, 170000.0, 2),
        ("May", 210000.0, 155000.0, 3),
        ("Jun", 175000.0, 168000.0, 4),
        ("Jul", 230000.0, 190000.0, 5),
        ("Aug", 78000.0, 50500.0, 6),
    ]
    db.add_all(
        [
            models.CashflowMonth(EntityId=personal.Id, Month=m, Year=2026, Inflow=i, Outflow=o, SortOrder=s)
            for m, i, o, s in personal_cf
        ]
    )
    db.add_all(
        [
            models.CashflowMonth(EntityId=business.Id, Month=m, Year=2026, Inflow=i, Outflow=o, SortOrder=s)
            for m, i, o, s in business_cf
        ]
    )

    db.add_all(
        [
            models.AutomationRule(
                Id="auto-1",
                EntityId=personal.Id,
                Name="Payday surplus sweep",
                Description="When salary lands, protect emergency buffer, then propose routing safe surplus into the Emergency Fund goal. You approve before anything moves.",
                Status="active_demo",
                Trigger="Income detected ≥ KES 50,000",
                Action="Propose KES safe-to-invest → Emergency Fund (approval required)",
                ActionType="send_money",
                TargetGoalId="goal-emergency",
                TriggerSpec={"kind": "income_detected", "threshold": 50000, "amount_min": 200},
                ActionSpec={
                    "op": "send_money",
                    "amount_rule": "safe_surplus",
                    "target_goal_id": "goal-emergency",
                    "recipient_mobile_no": "254700000000",
                },
                AutoApprove=False,
            ),
            models.AutomationRule(
                Id="auto-2",
                EntityId=business.Id,
                Name="Supplier buffer guard",
                Description="Keep 1 month of supplier obligations liquid before any investment sweep.",
                Status="coming_soon",
                Trigger="Weekly cash-flow review",
                Action="Block sweep if buffer breached",
                TriggerSpec={"kind": "weekly_recon"},
                ActionSpec={"op": "guard"},
                AutoApprove=True,
            ),
            models.AutomationRule(
                Id="auto-3",
                EntityId=personal.Id,
                Name="Obligation auto-pay (demo)",
                Description="When a household bill falls due within the window, settle it from liquid cash automatically. Demo mode — no live money.",
                Status="active_demo",
                Trigger="Obligation due within 3 days",
                Action="Auto-pay due obligations (demo)",
                ActionType="pay_bills",
                TriggerSpec={"kind": "due_date", "window_days": 3, "target": "obligations", "amount_min": 50},
                ActionSpec={"op": "pay_bills", "amount_rule": "fixed", "purpose": "Automated bill payment"},
                AutoApprove=True,
            ),
        ]
    )
    db.flush()
    db.add_all(
        [
            models.RuleRun(
                Id="run-auto-1",
                RuleId="auto-1",
                EntityId=personal.Id,
                TriggeredAt=_dt(2026, 8, 1, 6, 5),
                Outcome="executed",
                RunMode="simulated",
                ProposedAmount=18000,
                TxnReference="SIM-AUT-9F3A2C1D",
                Detail="Payday sweep executed — Emergency Fund +KES 18,000 (simulated).",
            ),
            models.RuleRun(
                Id="run-auto-3",
                RuleId="auto-3",
                EntityId=personal.Id,
                TriggeredAt=_dt(2026, 8, 10, 5, 2),
                Outcome="executed",
                RunMode="simulated",
                ProposedAmount=9500,
                TxnReference="SIM-AUT-77BE11",
                Detail="Auto-paid: Utility bills — household KES 9,500 (simulated).",
            ),
        ]
    )

    db.add_all(
        [
            models.ActivityEvent(Id="act-1", EntityId=personal.Id, Timestamp=AS_OF, Title="Surplus recalculated", Detail="Safe-to-invest updated after obligation scan", Kind="analysis"),
            models.ActivityEvent(Id="act-2", EntityId=personal.Id, Timestamp=_dt(2026, 8, 12, 14), Title="Goal progress", Detail="Emergency Fund +KES 15,000 from MMF allocation", Kind="goal"),
            models.ActivityEvent(Id="act-3", EntityId=business.Id, Timestamp=_dt(2026, 8, 11, 11), Title="Manual account updated", Detail="KCB Business balance refreshed by user", Kind="connection"),
        ]
    )

    db.add_all(
        [
            # Money market funds — the default parking spot for Kenyan surplus cash.
            models.MarketInstrument(Id="mkt-mmf-cic", Type="mmf", Name="CIC Money Market Fund", Provider="CIC Asset Management", YieldLabel="Illustrative 7-day yield", YieldValue="11.4% p.a.", Risk="low", Liquidity="T+1 (typical)", MinInvestment=5000, DataStatus="demo", AsOf=AS_OF, Notes="Demo comparison only — not a live quote."),
            models.MarketInstrument(Id="mkt-mmf-sanlam", Type="mmf", Name="Sanlam Money Market Fund", Provider="Sanlam Investments", YieldLabel="Illustrative 7-day yield", YieldValue="11.1% p.a.", Risk="low", Liquidity="T+1 (typical)", MinInvestment=2500, DataStatus="demo", AsOf=AS_OF),
            models.MarketInstrument(Id="mkt-mmf-britam", Type="mmf", Name="Britam Money Market Fund", Provider="Britam Asset Managers", YieldLabel="Illustrative 7-day yield", YieldValue="10.7% p.a.", Risk="low", Liquidity="T+1 (typical)", MinInvestment=1000, DataStatus="sample", AsOf=AS_OF),
            models.MarketInstrument(Id="mkt-mmf-ncba", Type="mmf", Name="NCBA Money Market Fund", Provider="NCBA Investment Bank", YieldLabel="Illustrative 7-day yield", YieldValue="10.9% p.a.", Risk="low", Liquidity="T+1 (typical)", MinInvestment=5000, DataStatus="sample", AsOf=AS_OF, Notes="Institutional partner fund — illustrative figures."),
            models.MarketInstrument(Id="mkt-mmf-zimele", Type="mmf", Name="Zimele Money Market Fund", Provider="Zimele Asset Management", YieldLabel="Illustrative 7-day yield", YieldValue="10.2% p.a.", Risk="low", Liquidity="T+2 (typical)", MinInvestment=100, DataStatus="sample", AsOf=AS_OF, Notes="Low entry point — suited to starting an emergency fund."),

            # Balanced / bond sleeve for surplus splits.
            models.MarketInstrument(Id="mkt-balanced-1", Type="tbond", Name="Sample balanced bond fund", Provider="Demo provider", YieldLabel="Illustrative blended yield", YieldValue="12.1% p.a.", Risk="moderate", Liquidity="T+2 / fund dealing", MinInvestment=2000, DataStatus="demo", AsOf=AS_OF, Notes="Stand-in for a balanced fund sleeve in surplus splits."),

            # Government paper — CBK auctions settled through DhowCSD.
            models.MarketInstrument(Id="mkt-tbill-91", Type="tbill", Name="91-day Treasury Bill", Provider="CBK / DhowCSD", YieldLabel="Sample accepted yield", YieldValue="9.4%", Risk="low", Liquidity="Until maturity / secondary", MinInvestment=100000, DataStatus="simulated", AsOf=_dt(2026, 8, 1), Notes="Simulated auction figure for product demo."),
            models.MarketInstrument(Id="mkt-tbill-182", Type="tbill", Name="182-day Treasury Bill", Provider="CBK / DhowCSD", YieldLabel="Sample accepted yield", YieldValue="10.1%", Risk="low", Liquidity="Until maturity / secondary", MinInvestment=100000, DataStatus="simulated", AsOf=_dt(2026, 8, 1)),
            models.MarketInstrument(Id="mkt-tbill-364", Type="tbill", Name="364-day Treasury Bill", Provider="CBK / DhowCSD", YieldLabel="Sample accepted yield", YieldValue="11.3%", Risk="low", Liquidity="Until maturity / secondary", MinInvestment=100000, DataStatus="simulated", AsOf=_dt(2026, 8, 1)),
            models.MarketInstrument(Id="mkt-tbond-fxd", Type="tbond", Name="FXD1/2026/10 Treasury Bond", Provider="CBK / DhowCSD", YieldLabel="Sample coupon", YieldValue="13.2%", Risk="moderate", Liquidity="Secondary market (NSE)", MinInvestment=50000, DataStatus="sample", AsOf=_dt(2026, 7, 1), Notes="10-year fixed coupon — illustrative."),
            models.MarketInstrument(Id="mkt-infra-bond", Type="infra_bond", Name="IFB1/2026/17 Infrastructure Bond", Provider="CBK / DhowCSD", YieldLabel="Sample coupon (tax free)", YieldValue="14.1%", Risk="moderate", Liquidity="Secondary market (NSE)", MinInvestment=50000, DataStatus="sample", AsOf=_dt(2026, 7, 1), Notes="Infrastructure bond coupons are exempt from withholding tax in Kenya."),

            # NSE — no live price feed is connected in this build.
            models.MarketInstrument(Id="mkt-nse-scom", Type="nse", Name="Safaricom PLC (SCOM)", Provider="NSE (feed not connected)", YieldLabel="Indicative dividend yield", YieldValue="6.2%", Risk="elevated", Liquidity="T+2", MinInvestment=1000, DataStatus="unavailable", Notes="Live NSE prices require a market data integration."),
            models.MarketInstrument(Id="mkt-nse-eqty", Type="nse", Name="Equity Group Holdings (EQTY)", Provider="NSE (feed not connected)", YieldLabel="Indicative dividend yield", YieldValue="7.8%", Risk="elevated", Liquidity="T+2", MinInvestment=1000, DataStatus="unavailable"),
            models.MarketInstrument(Id="mkt-nse-kcb", Type="nse", Name="KCB Group (KCB)", Provider="NSE (feed not connected)", YieldLabel="Indicative dividend yield", YieldValue="8.4%", Risk="elevated", Liquidity="T+2", MinInvestment=1000, DataStatus="unavailable"),
            models.MarketInstrument(Id="mkt-nse-eabl", Type="nse", Name="East African Breweries (EABL)", Provider="NSE (feed not connected)", YieldLabel="Indicative dividend yield", YieldValue="5.1%", Risk="elevated", Liquidity="T+2", MinInvestment=1000, DataStatus="unavailable"),
            models.MarketInstrument(Id="mkt-nse-n25", Type="nse", Name="NSE 25 Share Index basket", Provider="NSE (feed not connected)", YieldLabel="Data", YieldValue="Unavailable", Risk="elevated", Liquidity="T+2", MinInvestment=5000, DataStatus="unavailable", Notes="Diversified basket — placeholder until a market data feed is connected."),
        ]
    )

    db.add_all(
        [
            models.Provider(Slug="mpesa", Name="M-Pesa", Category="mpesa", Status="demo", Description="Mobile money balances and transaction history.", Capabilities=["balances", "transactions"]),
            models.Provider(Slug="equity-bank", Name="Equity Bank", Category="bank", Status="manual", Description="Bank account balances via statement upload or Open Banking (future).", Capabilities=["balances", "transactions", "statements"]),
            models.Provider(Slug="kcb", Name="KCB", Category="bank", Status="coming_soon", Description="Bank API / Open Banking connection — not live in this build.", Capabilities=["balances", "transactions"]),
            models.Provider(Slug="sacco-generic", Name="SACCO (manual)", Category="sacco", Status="manual", Description="Member deposits and shares entered manually until SACCO APIs exist.", Capabilities=["balances"]),
            models.Provider(Slug="mmf-aggregate", Name="Money Market Funds", Category="mmf", Status="demo", Description="MMF holdings and illustrative yield comparison (demo data).", Capabilities=["holdings", "yields"]),
            models.Provider(Slug="nse", Name="NSE", Category="nse", Status="coming_soon", Description="Listed equities market data feed — placeholder for future integration.", Capabilities=["prices", "holdings"]),
            models.Provider(Slug="cbk-dhowcsd", Name="CBK / DhowCSD", Category="treasury", Status="coming_soon", Description="Treasury bills and bonds — integration required.", Capabilities=["auctions", "holdings"]),
        ]
    )

    chama = models.Entity(
        Id="ent-chama",
        UserId=user.Id,
        Type="CHAMA",
        Name="Tuinuane Chama",
        Description="12-member savings circle — monthly contributions and a shared land goal",
    )
    db.add(chama)
    db.flush()

    db.add_all(
        [
            models.Account(Id="acc-chama-mpesa", EntityId=chama.Id, Name="Chama M-Pesa pool", Provider="mpesa", Institution="Safaricom", Balance=168000, ConnectionStatus="demo", Provenance="demo", IsLiquid=True, LastUpdated=AS_OF),
            models.Account(Id="acc-chama-sacco", EntityId=chama.Id, Name="Chama SACCO deposit", Provider="sacco", Institution="Umoja SACCO", Balance=420000, ConnectionStatus="manual", Provenance="user_entered", IsLiquid=False, LastUpdated=_dt(2026, 8, 1)),
        ]
    )
    db.add_all(
        [
            models.Goal(Id="goal-chama-land", EntityId=chama.Id, Name="Group land purchase", Category="property", Target=2400000, Current=588000, Deadline=_dt(2028, 12, 1), MonthlyContribution=60000, Priority=1),
            models.Goal(Id="goal-chama-buffer", EntityId=chama.Id, Name="Emergency lending pool", Category="emergency", Target=300000, Current=145000, Deadline=_dt(2027, 6, 1), MonthlyContribution=15000, Priority=2),
        ]
    )
    db.add_all(
        [
            models.Transaction(Id="tx-ch-1", EntityId=chama.Id, AccountId="acc-chama-mpesa", Date=_dt(2026, 8, 5), Description="Monthly contributions — 12 members", Amount=60000, Category="Contributions", Type="inflow", Provenance="demo"),
            models.Transaction(Id="tx-ch-2", EntityId=chama.Id, AccountId="acc-chama-mpesa", Date=_dt(2026, 8, 9), Description="Member loan disbursement — J. Wanjiru", Amount=25000, Category="Lending", Type="outflow", Provenance="demo"),
            models.Transaction(Id="tx-ch-3", EntityId=chama.Id, AccountId="acc-chama-sacco", Date=_dt(2026, 8, 12), Description="Transfer to SACCO deposit", Amount=40000, Category="Invest / Save", Type="outflow", Provenance="demo"),
        ]
    )
    db.add_all(
        [
            models.RiskProfile(EntityId=chama.Id, Horizon="long", Tolerance="low", EmergencyFundMonthsTarget=3, Notes="Group capital — preservation first, decisions by vote"),
            models.SurplusConfig(EntityId=chama.Id, LiquidBalanceOverride=None, EmergencyBufferOverride=80000, DiscretionarySpendRatio=0.2),
        ]
    )
    db.add_all(
        [
            models.CashflowMonth(EntityId=chama.Id, Month=m, Year=2026, Inflow=i, Outflow=o, SortOrder=sort)
            for m, i, o, sort in [
                ("Mar", 60000.0, 20000.0, 1),
                ("Apr", 60000.0, 45000.0, 2),
                ("May", 65000.0, 30000.0, 3),
                ("Jun", 60000.0, 25000.0, 4),
                ("Jul", 60000.0, 55000.0, 5),
                ("Aug", 60000.0, 65000.0, 6),
            ]
        ]
    )
    db.add_all(
        [
            models.ProfileMember(EntityId=chama.Id, UserId=user.Id, Role="treasurer", JoinedAt=_dt(2024, 3, 1)),
            models.ProfileMember(EntityId=personal.Id, UserId=user.Id, Role="owner", JoinedAt=_dt(2024, 1, 1)),
            models.ProfileMember(EntityId=business.Id, UserId=user.Id, Role="owner", JoinedAt=_dt(2024, 1, 1)),
        ]
    )
    db.add(
        models.BusinessProfileDetails(
            EntityId=business.Id,
            RegistrationNumber="PVT-8KJ4MW2",
            KraPin="P051234567X",
            BusinessType="Sole proprietorship",
            RegisteredAt=_dt(2024, 2, 14),
        )
    )

    suppliers = [
        models.Supplier(Id="sup-fabrics", EntityId=business.Id, Name="Nairobi Fabric House", TrustScore=87, PaybillOrTill="888880", PaymentHistory={"onTimePayments": 22, "latePayments": 1, "averageDays": 4}),
        models.Supplier(Id="sup-dyes", EntityId=business.Id, Name="Rift Valley Dyes & Thread", TrustScore=72, PaybillOrTill="247247", PaymentHistory={"onTimePayments": 14, "latePayments": 3, "averageDays": 9}),
        models.Supplier(Id="sup-packaging", EntityId=business.Id, Name="Kariobangi Packaging Co-op", TrustScore=64, PaybillOrTill="522522", PaymentHistory={"onTimePayments": 8, "latePayments": 4, "averageDays": 13}),
    ]
    db.add_all(suppliers)
    db.flush()

    db.add_all(
        [
            models.BnplAgreement(Id="bnpl-fabrics", SupplierId="sup-fabrics", Principal=120000, Balance=45000, Status="active", InstallmentSchedule=[
                {"dueDate": "2026-08-30", "amount": 15000, "status": "upcoming"},
                {"dueDate": "2026-09-30", "amount": 15000, "status": "upcoming"},
                {"dueDate": "2026-10-30", "amount": 15000, "status": "upcoming"},
            ]),
            models.BnplAgreement(Id="bnpl-dyes", SupplierId="sup-dyes", Principal=60000, Balance=0, Status="settled", InstallmentSchedule=[
                {"dueDate": "2026-06-30", "amount": 30000, "status": "paid"},
                {"dueDate": "2026-07-30", "amount": 30000, "status": "paid"},
            ]),
        ]
    )

    db.commit()
    print(f"Seeded Cash-Flow demo database for {user.Name}")


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
