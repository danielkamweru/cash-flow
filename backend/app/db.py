from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine = create_engine(
    settings.sqlalchemy_database_url,
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(text('ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PasswordHash" text'))
        conn.execute(text('ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PinHash" text'))
        conn.execute(text('ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "Role" text NOT NULL DEFAULT \'user\''))
        conn.execute(text('ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "Phone" text'))
        conn.execute(text('ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "Location" text'))
        conn.execute(text('ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "CreatedAt" timestamptz'))
        conn.execute(text('ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "UpdatedAt" timestamptz'))
        conn.execute(text('ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS "Channel" text'))
        conn.execute(
            text(
                'ALTER TABLE "Accounts" '
                'ADD COLUMN IF NOT EXISTS "IsEmergencyReserve" boolean NOT NULL DEFAULT false'
            )
        )
        conn.execute(text('ALTER TABLE "Transactions" ADD COLUMN IF NOT EXISTS "Metadata" jsonb'))
        conn.execute(text('ALTER TABLE "Transactions" ADD COLUMN IF NOT EXISTS "PaymentReference" text'))
        conn.execute(
            text('ALTER TABLE "Transactions" ADD COLUMN IF NOT EXISTS "Status" text NOT NULL DEFAULT \'completed\'')
        )
        conn.execute(text('ALTER TABLE "AutomationRules" ADD COLUMN IF NOT EXISTS "ActionType" text'))
        conn.execute(text('ALTER TABLE "AutomationRules" ADD COLUMN IF NOT EXISTS "AuthorizedAt" timestamptz'))
        conn.execute(text('ALTER TABLE "AutomationRules" ADD COLUMN IF NOT EXISTS "ExecutedAt" timestamptz'))
        conn.execute(text('ALTER TABLE "AutomationRules" ADD COLUMN IF NOT EXISTS "TargetGoalId" text'))
        conn.execute(
            text(
                'ALTER TABLE "SurplusConfigs" '
                'ADD COLUMN IF NOT EXISTS "AutomationEnabled" boolean NOT NULL DEFAULT true'
            )
        )
        conn.execute(
            text('ALTER TABLE "AutomationRules" ADD COLUMN IF NOT EXISTS "TriggerSpec" jsonb')
        )
        conn.execute(
            text('ALTER TABLE "AutomationRules" ADD COLUMN IF NOT EXISTS "ActionSpec" jsonb')
        )
        conn.execute(
            text(
                'ALTER TABLE "AutomationRules" '
                'ADD COLUMN IF NOT EXISTS "AutoApprove" boolean NOT NULL DEFAULT false'
            )
        )
        conn.execute(
            text('ALTER TABLE "AutomationRules" ADD COLUMN IF NOT EXISTS "LastRunAt" timestamptz')
        )
        conn.execute(
            text('ALTER TABLE "AutomationRules" ADD COLUMN IF NOT EXISTS "NextRunAt" timestamptz')
        )
