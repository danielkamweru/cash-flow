from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def new_id() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "Users"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    Name: Mapped[str] = mapped_column(String, nullable=False)
    Email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    Phone: Mapped[str | None] = mapped_column(String, nullable=True)
    Location: Mapped[str | None] = mapped_column(String, nullable=True)
    PasswordHash: Mapped[str | None] = mapped_column(Text, nullable=True)
    PinHash: Mapped[str | None] = mapped_column(Text, nullable=True)
    Role: Mapped[str] = mapped_column(String, nullable=False, default="user")
    CreatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    UpdatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    entities: Mapped[list[Entity]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Entity(Base):
    __tablename__ = "Entities"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    UserId: Mapped[str] = mapped_column(String, ForeignKey("Users.Id", ondelete="CASCADE"), nullable=False)
    Type: Mapped[str] = mapped_column(String, nullable=False)
    Name: Mapped[str] = mapped_column(String, nullable=False)
    Description: Mapped[str | None] = mapped_column(String, nullable=True)
    CreatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    UpdatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="entities")


class Account(Base):
    __tablename__ = "Accounts"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False)
    Name: Mapped[str] = mapped_column(String, nullable=False)
    Provider: Mapped[str] = mapped_column(String, nullable=False)
    Institution: Mapped[str] = mapped_column(String, nullable=False)
    Balance: Mapped[float] = mapped_column(Float, nullable=False)
    Currency: Mapped[str] = mapped_column(String, nullable=False, default="KES")
    ConnectionStatus: Mapped[str] = mapped_column(String, nullable=False)
    Provenance: Mapped[str] = mapped_column(String, nullable=False)
    AccountMask: Mapped[str | None] = mapped_column(String, nullable=True)
    IsLiquid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    LastUpdated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    CreatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    Channel: Mapped[str | None] = mapped_column(String, nullable=True)
    IsEmergencyReserve: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Transaction(Base):
    __tablename__ = "Transactions"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False)
    AccountId: Mapped[str] = mapped_column(String, ForeignKey("Accounts.Id", ondelete="CASCADE"), nullable=False)
    Date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    Description: Mapped[str] = mapped_column(String, nullable=False)
    Amount: Mapped[float] = mapped_column(Float, nullable=False)
    Category: Mapped[str] = mapped_column(String, nullable=False)
    Type: Mapped[str] = mapped_column(String, nullable=False)
    Provenance: Mapped[str] = mapped_column(String, nullable=False)
    CreatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    Metadata: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    LoopTxnReference: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    Status: Mapped[str] = mapped_column(String, nullable=False, default="completed")


class Asset(Base):
    __tablename__ = "Assets"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False)
    Name: Mapped[str] = mapped_column(String, nullable=False)
    Category: Mapped[str] = mapped_column(String, nullable=False)
    Value: Mapped[float] = mapped_column(Float, nullable=False)
    Liquidity: Mapped[str] = mapped_column(String, nullable=False)
    Provenance: Mapped[str] = mapped_column(String, nullable=False)
    LastUpdated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Investment(Base):
    __tablename__ = "Investments"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False)
    Name: Mapped[str] = mapped_column(String, nullable=False)
    Type: Mapped[str] = mapped_column(String, nullable=False)
    Value: Mapped[float] = mapped_column(Float, nullable=False)
    CostBasis: Mapped[float | None] = mapped_column(Float, nullable=True)
    Liquidity: Mapped[str] = mapped_column(String, nullable=False)
    Risk: Mapped[str] = mapped_column(String, nullable=False)
    Provenance: Mapped[str] = mapped_column(String, nullable=False)
    Notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    LastUpdated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Liability(Base):
    __tablename__ = "Liabilities"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False)
    Name: Mapped[str] = mapped_column(String, nullable=False)
    Lender: Mapped[str] = mapped_column(String, nullable=False)
    Balance: Mapped[float] = mapped_column(Float, nullable=False)
    MonthlyPayment: Mapped[float] = mapped_column(Float, nullable=False)
    InterestRate: Mapped[float | None] = mapped_column(Float, nullable=True)
    DueDay: Mapped[int | None] = mapped_column(Integer, nullable=True)
    Provenance: Mapped[str] = mapped_column(String, nullable=False)
    LastUpdated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Obligation(Base):
    __tablename__ = "Obligations"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False)
    Name: Mapped[str] = mapped_column(String, nullable=False)
    Amount: Mapped[float] = mapped_column(Float, nullable=False)
    DueDate: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    Category: Mapped[str] = mapped_column(String, nullable=False)
    Status: Mapped[str] = mapped_column(String, nullable=False)


class Goal(Base):
    __tablename__ = "Goals"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False)
    Name: Mapped[str] = mapped_column(String, nullable=False)
    Category: Mapped[str] = mapped_column(String, nullable=False)
    Target: Mapped[float] = mapped_column(Float, nullable=False)
    Current: Mapped[float] = mapped_column(Float, nullable=False)
    Deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    MonthlyContribution: Mapped[float] = mapped_column(Float, nullable=False)
    Priority: Mapped[int] = mapped_column(Integer, nullable=False)


class RiskProfile(Base):
    __tablename__ = "RiskProfiles"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False, unique=True)
    Horizon: Mapped[str] = mapped_column(String, nullable=False)
    Tolerance: Mapped[str] = mapped_column(String, nullable=False)
    EmergencyFundMonthsTarget: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    Notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class CreditReadiness(Base):
    __tablename__ = "CreditReadinesses"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False, unique=True)
    Level: Mapped[str] = mapped_column(String, nullable=False)
    IncomeMonthly: Mapped[float] = mapped_column(Float, nullable=False)
    ExpensesMonthly: Mapped[float] = mapped_column(Float, nullable=False)
    MonthlySurplus: Mapped[float] = mapped_column(Float, nullable=False)
    LiquidAssets: Mapped[float] = mapped_column(Float, nullable=False)
    Investments: Mapped[float] = mapped_column(Float, nullable=False)
    Liabilities: Mapped[float] = mapped_column(Float, nullable=False)
    DebtBurdenRatio: Mapped[float] = mapped_column(Float, nullable=False)
    SavingsConsistency: Mapped[float] = mapped_column(Float, nullable=False)
    HistoryMonths: Mapped[int] = mapped_column(Integer, nullable=False)
    NotesJson: Mapped[Any] = mapped_column(JSONB, nullable=False)
    Disclaimer: Mapped[str] = mapped_column(Text, nullable=False)
    LastUpdated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MarketInstrument(Base):
    __tablename__ = "MarketInstruments"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    Type: Mapped[str] = mapped_column(String, nullable=False)
    Name: Mapped[str] = mapped_column(String, nullable=False)
    Provider: Mapped[str] = mapped_column(String, nullable=False)
    YieldLabel: Mapped[str] = mapped_column(String, nullable=False)
    YieldValue: Mapped[str] = mapped_column(String, nullable=False)
    Risk: Mapped[str] = mapped_column(String, nullable=False)
    Liquidity: Mapped[str] = mapped_column(String, nullable=False)
    MinInvestment: Mapped[float] = mapped_column(Float, nullable=False)
    DataStatus: Mapped[str] = mapped_column(String, nullable=False)
    AsOf: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    Notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Provider(Base):
    __tablename__ = "Providers"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    Slug: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    Name: Mapped[str] = mapped_column(String, nullable=False)
    Category: Mapped[str] = mapped_column(String, nullable=False)
    Status: Mapped[str] = mapped_column(String, nullable=False)
    Description: Mapped[str] = mapped_column(Text, nullable=False)
    Capabilities: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)


class AutomationRule(Base):
    __tablename__ = "AutomationRules"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False)
    Name: Mapped[str] = mapped_column(String, nullable=False)
    Description: Mapped[str] = mapped_column(Text, nullable=False)
    Status: Mapped[str] = mapped_column(String, nullable=False)
    Trigger: Mapped[str] = mapped_column(Text, nullable=False)
    Action: Mapped[str] = mapped_column(Text, nullable=False)
    ActionType: Mapped[str | None] = mapped_column(String, nullable=True)
    AuthorizedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ExecutedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    TargetGoalId: Mapped[str | None] = mapped_column(String, ForeignKey("Goals.Id", ondelete="SET NULL"), nullable=True)
    # Structured engine spec. The prose Trigger/Action above stay for humans;
    # the engine evaluates and runs these.
    TriggerSpec: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    ActionSpec: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    AutoApprove: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    LastRunAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    NextRunAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    runs: Mapped[list[RuleRun]] = relationship(
        back_populates="rule", cascade="all, delete-orphan", order_by="RuleRun.TriggeredAt.desc()"
    )


class RuleRun(Base):
    """One evaluation/execution attempt of an automation rule."""

    __tablename__ = "RuleRuns"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    RuleId: Mapped[str] = mapped_column(String, ForeignKey("AutomationRules.Id", ondelete="CASCADE"), nullable=False)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False)
    TriggeredAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    Outcome: Mapped[str] = mapped_column(String, nullable=False)  # proposed|approved|declined|executed|failed|skipped|guarded
    RunMode: Mapped[str] = mapped_column(String, nullable=False, default="simulated")  # dry_run|simulated|live
    ProposedAmount: Mapped[float | None] = mapped_column(Float, nullable=True)
    TxnReference: Mapped[str | None] = mapped_column(String, nullable=True)
    Error: Mapped[str | None] = mapped_column(Text, nullable=True)
    Detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    rule: Mapped[AutomationRule] = relationship(back_populates="runs")


class ActivityEvent(Base):
    __tablename__ = "ActivityEvents"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False)
    Timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    Title: Mapped[str] = mapped_column(String, nullable=False)
    Detail: Mapped[str] = mapped_column(Text, nullable=False)
    Kind: Mapped[str] = mapped_column(String, nullable=False)


class CashflowMonth(Base):
    __tablename__ = "CashflowMonths"
    __table_args__ = (UniqueConstraint("EntityId", "Year", "Month", name="IX_CashflowMonths_EntityId_Year_Month"),)

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False)
    Month: Mapped[str] = mapped_column(String, nullable=False)
    Year: Mapped[int] = mapped_column(Integer, nullable=False)
    SortOrder: Mapped[int] = mapped_column(Integer, nullable=False)
    Inflow: Mapped[float] = mapped_column(Float, nullable=False)
    Outflow: Mapped[float] = mapped_column(Float, nullable=False)


class SurplusConfig(Base):
    __tablename__ = "SurplusConfigs"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False, unique=True)
    LiquidBalanceOverride: Mapped[float | None] = mapped_column(Float, nullable=True)
    EmergencyBufferOverride: Mapped[float | None] = mapped_column(Float, nullable=True)
    DiscretionarySpendRatio: Mapped[float] = mapped_column(Float, nullable=False, default=0.33)
    # When True, surplus invest plan runs autonomously (demo routing). When False, recommend only.
    AutomationEnabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Supplier(Base):
    __tablename__ = "Suppliers"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False)
    Name: Mapped[str] = mapped_column(String, nullable=False)
    TrustScore: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    PaybillOrTill: Mapped[str | None] = mapped_column(String, nullable=True)
    PaymentHistory: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    CreatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BnplAgreement(Base):
    __tablename__ = "BnplAgreements"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    SupplierId: Mapped[str] = mapped_column(String, ForeignKey("Suppliers.Id", ondelete="CASCADE"), nullable=False)
    Principal: Mapped[float] = mapped_column(Float, nullable=False)
    Balance: Mapped[float] = mapped_column(Float, nullable=False)
    InstallmentSchedule: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    Status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    CreatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Recommendation(Base):
    __tablename__ = "Recommendations"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False)
    Title: Mapped[str] = mapped_column(String, nullable=False)
    Summary: Mapped[str] = mapped_column(Text, nullable=False)
    Why: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    Opportunity: Mapped[str | None] = mapped_column(Text, nullable=True)
    Risk: Mapped[str] = mapped_column(String, nullable=False)
    Liquidity: Mapped[str] = mapped_column(String, nullable=False)
    TimeHorizon: Mapped[str] = mapped_column(String, nullable=False)
    Assumptions: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    ActionLabel: Mapped[str] = mapped_column(String, nullable=False)
    ActionState: Mapped[str] = mapped_column(String, nullable=False)
    RelatedGoalId: Mapped[str | None] = mapped_column(String, ForeignKey("Goals.Id", ondelete="SET NULL"), nullable=True)
    Status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    CreatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    DecidedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ProfileMember(Base):
    __tablename__ = "ProfileMembers"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False)
    UserId: Mapped[str] = mapped_column(String, ForeignKey("Users.Id", ondelete="CASCADE"), nullable=False)
    Role: Mapped[str] = mapped_column(String, nullable=False, default="member")
    JoinedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BusinessProfileDetails(Base):
    __tablename__ = "BusinessProfileDetails"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False, unique=True)
    RegistrationNumber: Mapped[str | None] = mapped_column(String, nullable=True)
    KraPin: Mapped[str | None] = mapped_column(String, nullable=True)
    BusinessType: Mapped[str | None] = mapped_column(String, nullable=True)
    RegisteredAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Invoice(Base):
    """Money owed *to* the business — the receivables half of working capital."""

    __tablename__ = "Invoices"

    Id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    EntityId: Mapped[str] = mapped_column(String, ForeignKey("Entities.Id", ondelete="CASCADE"), nullable=False)
    Number: Mapped[str] = mapped_column(String, nullable=False)
    CustomerName: Mapped[str] = mapped_column(String, nullable=False)
    CustomerPhone: Mapped[str | None] = mapped_column(String, nullable=True)
    Amount: Mapped[float] = mapped_column(Float, nullable=False)
    AmountPaid: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    IssuedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    DueDate: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # draft | sent | part_paid | paid | overdue | cancelled
    Status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    Notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    LineItems: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    # Set when a payment prompt has been pushed to the customer.
    LoopTxnReference: Mapped[str | None] = mapped_column(String, nullable=True)
    CreatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
