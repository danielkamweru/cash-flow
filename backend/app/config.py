from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url: str) -> str:
    """Render/Heroku use postgres://; SQLAlchemy + psycopg need postgresql+psycopg://."""
    value = (url or "").strip()
    if value.startswith("postgres://"):
        value = "postgresql+psycopg://" + value[len("postgres://"):]
    elif value.startswith("postgresql://") and "+psycopg" not in value:
        value = "postgresql+psycopg://" + value[len("postgresql://"):]

    local = "localhost" in value or "127.0.0.1" in value
    if value and not local and "sslmode=" not in value:
        value += ("&" if "?" in value else "?") + "sslmode=require"
    return value


def parse_cors_origins(raw: str) -> List[str]:
    return [part.strip() for part in (raw or "").split(",") if part.strip()]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    port: int = 8000
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/cashflow"
    cors_origin: str = "http://localhost:3000"
    cors_origin_regex: str = ""
    jwt_secret: str = "cash-flow-dev-secret-change-me"
    jwt_expire_hours: int = 72

    # ------------------------------------------------------------------
    # Safaricom Daraja M-Pesa
    # ------------------------------------------------------------------
    daraja_consumer_key: str = ""
    daraja_consumer_secret: str = ""
    daraja_shortcode: str = ""
    daraja_passkey: str = ""
    daraja_auth_url: str = (
        "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    )
    daraja_stk_push_url: str = (
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
    )
    # Must be a publicly reachable HTTPS URL for Safaricom to POST callbacks.
    # Use a tunnel (e.g. ngrok) in local development.
    daraja_callback_url: str = ""

    # ------------------------------------------------------------------
    # Safaricom Daraja Business Buy Goods (B2B)
    # ------------------------------------------------------------------
    daraja_b2b_url: str = (
        "https://sandbox.safaricom.co.ke/mpesa/b2b/v1/paymentrequest"
    )
    # API operator username (initiator)
    daraja_b2b_initiator: str = ""
    # Encrypted SecurityCredential from Daraja portal
    daraja_b2b_security_credential: str = ""
    # Shortcode sending funds (usually same as daraja_shortcode for paybill)
    daraja_b2b_party_a: str = ""
    # Default recipient shortcode (merchant/till/paybill receiving funds)
    daraja_b2b_party_b: str = ""
    # Public HTTPS callbacks Daraja can reach — use a tunnel (ngrok) for local dev
    daraja_b2b_queue_timeout_url: str = ""
    daraja_b2b_result_url: str = ""

    # ------------------------------------------------------------------
    # Optional integrations
    # ------------------------------------------------------------------
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

    @property
    def daraja_configured(self) -> bool:
        return bool(
            self.daraja_consumer_key.strip()
            and self.daraja_consumer_secret.strip()
            and self.daraja_shortcode.strip()
            and self.daraja_passkey.strip()
        )

    @property
    def daraja_b2b_configured(self) -> bool:
        return bool(
            self.daraja_consumer_key.strip()
            and self.daraja_consumer_secret.strip()
            and self.daraja_b2b_initiator.strip()
            and self.daraja_b2b_security_credential.strip()
            and self.daraja_b2b_party_a.strip()
            and self.daraja_b2b_party_b.strip()
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
