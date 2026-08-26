from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url: str) -> str:
    """Render/Heroku use postgres://; SQLAlchemy + psycopg need postgresql+psycopg://."""
    value = (url or "").strip()
    if value.startswith("postgres://"):
        value = "postgresql+psycopg://" + value[len("postgres://") :]
    elif value.startswith("postgresql://") and "+psycopg" not in value:
        value = "postgresql+psycopg://" + value[len("postgresql://") :]

    # Managed Postgres (Render, etc.) generally requires TLS
    local = "localhost" in value or "127.0.0.1" in value
    if value and not local and "sslmode=" not in value:
        value += ("&" if "?" in value else "?") + "sslmode=require"
    return value


def parse_cors_origins(raw: str) -> List[str]:
    return [part.strip() for part in (raw or "").split(",") if part.strip()]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    port: int = 8000
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/wealthloop"
    # Comma-separated list, e.g. https://app.vercel.app,http://localhost:3000
    cors_origin: str = "http://localhost:3000"
    # Optional regex for Vercel preview deployments, e.g. https://.*\\.vercel\\.app
    cors_origin_regex: str = ""
    jwt_secret: str = "wealth-loop-dev-secret-change-me"
    jwt_expire_hours: int = 72

    loop_base_url: str = "https://sandbox.loop.co.ke"
    loop_gateway_base_url: str = "https://sandbox.loop.co.ke/gateway"
    # LOOP requires https callBackUrl — localhost http is rejected with 412
    loop_callback_base_url: str = "https://httpbin.org"
    loop_consumer_key: str = ""
    loop_consumer_secret: str = ""
    loop_default_till: str = "133239"
    loop_default_till_secret: str = ""

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    gemini_api_key: str = ""

    @property
    def sqlalchemy_database_url(self) -> str:
        return normalize_database_url(self.database_url)

    @property
    def cors_origins(self) -> List[str]:
        origins = parse_cors_origins(self.cors_origin)
        return origins or ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def loop_callback_url(kind: str) -> str:
    """Build a LOOP-compliant https callBackUrl (never http://localhost)."""
    settings = get_settings()
    base = (settings.loop_callback_base_url or "").strip().rstrip("/")
    path = f"/api/loop/callbacks/{kind}" if kind else ""
    if base.lower().startswith("https://"):
        return f"{base}{path}" if path else base
    return "https://httpbin.org/post"
