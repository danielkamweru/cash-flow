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
