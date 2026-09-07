from __future__ import annotations

from sqlalchemy.orm import Session

from app import models


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
