from __future__ import annotations

import hashlib
import hmac
import threading
import uuid
from base64 import b64encode
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.config import Settings, get_settings


@dataclass(frozen=True)
class LoopProduct:
    base_path: str
    operation_path: str
    service_code: str
    signing_field: str
    fixed_channel: str | None = None


LOOP_PROMPT = LoopProduct("/loop-prompt/2", "/services/process-request", "NEO_MRCHNT_RTP", "merchantTill")
MPESA_PROMPT = LoopProduct("/mpesa-prompt/2.0", "/services/process-request", "NEO_MRCHNT_STK", "tillNo")
TRANSACTION_INQUIRY = LoopProduct("/transaction-inquiry/1.0.0", "/services/process-request", "MRCHNT_TXN_INQUIRY", "merchantTill")
TRANSACTION_HISTORY = LoopProduct("/transaction-history/1.0.0", "/services/process-request", "MRCHNT_TXN_HISTORY", "merchantTill")
PAY_TO_LOOP_TILL = LoopProduct("/pay-to-looptill/1.0", "/services/process-request", "MRCHNT_PAYMENTS", "merchantTill", "LOOP")
PAY_TO_MPESA_TILL = LoopProduct("/pay-to-mpesa-till/1.0", "/services/process-request", "MRCHNT_PAYMENTS", "merchantTill", "LOOP")
PAY_TO_PAYBILL = LoopProduct("/pay-to-paybill/1.0", "/services/process-request", "MRCHNT_PAYMENTS", "merchantTill", "LOOP")
SEND_MONEY_LOOP = LoopProduct("/send-money-loop/1.0", "/services/process-service-request2", "MRCHNT_SENDMONEY", "merchantTill", "LOOP")
SEND_MONEY_MPESA = LoopProduct("/send-money-mpesa/1.0", "/services/process-request", "MRCHNT_SENDMONEY", "merchantTill", "MPESA")
SEND_MONEY_PESALINK = LoopProduct("/send-money-pesalink/1.0", "/services/process-request", "MRCHNT_SENDMONEY", "merchantTill", "PESALINK")


def sign(till: str, timestamp: str, nonce: str, secret: str) -> str:
    message = f"{till}|{timestamp}|{nonce}".encode()
    digest = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
    return digest


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def nonce() -> str:
    return str(uuid.uuid4()).lower()


class LoopTokenService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._lock = threading.Lock()
        self._access_token: str | None = None
        self._expires_at: datetime = datetime.min.replace(tzinfo=timezone.utc)

    def get_access_token(self) -> str:
        now = datetime.now(timezone.utc)
        if self._access_token and now < self._expires_at:
            return self._access_token

        with self._lock:
            now = datetime.now(timezone.utc)
            if self._access_token and now < self._expires_at:
                return self._access_token

            credentials = b64encode(
                f"{self.settings.loop_consumer_key}:{self.settings.loop_consumer_secret}".encode()
            ).decode()
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.settings.loop_base_url.rstrip('/')}/oauth2/token",
                    headers={"Authorization": f"Basic {credentials}"},
                    data={"grant_type": "client_credentials"},
                )
                response.raise_for_status()
                payload = response.json()
            self._access_token = payload["access_token"]
            expires_in = int(payload["expires_in"])
            self._expires_at = now + timedelta(seconds=expires_in - 60)
            return self._access_token


class LoopGatewayClient:
    def __init__(self, settings: Settings | None = None, token_service: LoopTokenService | None = None) -> None:
        self.settings = settings or get_settings()
        self.token_service = token_service or LoopTokenService(self.settings)

    def send(
        self,
        product: LoopProduct,
        business_params: dict[str, Any],
        till: str | None = None,
        till_secret: str | None = None,
        txn_reference: str | None = None,
    ) -> dict[str, Any]:
        resolved_till = till or self.settings.loop_default_till
        resolved_secret = till_secret or self.settings.loop_default_till_secret
        ts = timestamp()
        n = nonce()
        signature = sign(resolved_till, ts, n, resolved_secret)

        request_parameters = {
            **business_params,
            product.signing_field: resolved_till,
            "timestamp": ts,
            "nonce": n,
            "signature": signature,
        }
        if product.fixed_channel is not None:
            request_parameters["channel"] = product.fixed_channel

        envelope = {
            "serviceCode": product.service_code,
            "txnReference": txn_reference or str(uuid.uuid4()),
            "requestParameters": request_parameters,
        }

        token = self.token_service.get_access_token()
        url = f"{self.settings.loop_gateway_base_url.rstrip('/')}{product.base_path}{product.operation_path}"
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                url,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=envelope,
            )
            try:
                body = response.json()
            except Exception:
                body = {"message": response.text}

        return {
            "statusCode": body.get("statusCode", response.status_code),
            "message": body.get("message"),
            "data": body.get("data"),
            # Callers need this to reconcile the ledger entry with LOOP later.
            "txnReference": envelope["txnReference"],
        }


_gateway: LoopGatewayClient | None = None


def get_gateway() -> LoopGatewayClient:
    global _gateway
    if _gateway is None:
        _gateway = LoopGatewayClient()
    return _gateway
