"""Safaricom Daraja M-Pesa integration.

Architecture:
    Cash-Flow Backend
        ↓
    DarajaAuthService  →  OAuth token (cached, never exposed)
        ↓
    DarajaSTKService   →  STK Push request
        ↓
    Customer phone     →  M-Pesa prompt
        ↓
    Safaricom callback →  /api/mpesa/callback

    DarajaB2BService   →  Business Buy Goods (B2B) payment request
        ↓
    Safaricom async    →  /api/daraja/b2b/result and /queue-timeout
"""

from __future__ import annotations

import re
import threading
from base64 import b64encode
from datetime import datetime, timedelta, timezone

import httpx

from app.config import Settings, get_settings


# ---------------------------------------------------------------------------
# Phone normalisation
# ---------------------------------------------------------------------------

def normalize_phone(raw: str) -> str:
    """Normalise common Kenyan formats to 2547XXXXXXXX required by Daraja.

    Accepts:
        07XXXXXXXX   → 2547XXXXXXXX
        2547XXXXXXXX → 2547XXXXXXXX
        +2547XXXXXXXX → 2547XXXXXXXX
    Raises ValueError for anything that doesn't match.
    """
    phone = re.sub(r"[\s\-()]", "", raw or "")
    if phone.startswith("+"):
        phone = phone[1:]
    if phone.startswith("07") and len(phone) == 10:
        phone = "254" + phone[1:]
    if re.fullmatch(r"2547\d{8}", phone):
        return phone
    raise ValueError(
        f"Invalid Kenyan phone number '{raw}'. "
        "Use 07XXXXXXXX, 2547XXXXXXXX, or +2547XXXXXXXX."
    )


# ---------------------------------------------------------------------------
# Auth service — OAuth 2.0 client credentials
# ---------------------------------------------------------------------------

class DarajaAuthService:
    """Fetches and caches a Daraja OAuth access token.

    The token is cached until 60 s before expiry and refreshed under a lock
    so concurrent requests never trigger duplicate auth calls.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._lock = threading.Lock()
        self._token: str | None = None
        self._expires_at: datetime = datetime.min.replace(tzinfo=timezone.utc)

    def get_access_token(self) -> str:
        now = datetime.now(timezone.utc)
        if self._token and now < self._expires_at:
            return self._token

        with self._lock:
            now = datetime.now(timezone.utc)
            if self._token and now < self._expires_at:
                return self._token

            s = self._settings
            if not s.daraja_consumer_key or not s.daraja_consumer_secret:
                raise RuntimeError(
                    "DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET must be set."
                )

            credentials = b64encode(
                f"{s.daraja_consumer_key}:{s.daraja_consumer_secret}".encode()
            ).decode()

            with httpx.Client(timeout=30.0) as client:
                try:
                    resp = client.get(
                        s.daraja_auth_url,
                        headers={"Authorization": f"Basic {credentials}"},
                    )
                except httpx.HTTPError as exc:
                    raise RuntimeError(
                        f"Daraja auth request failed: {exc}"
                    ) from exc

            if resp.status_code != 200:
                raise RuntimeError(
                    f"Daraja auth failed ({resp.status_code}): {resp.text[:200]}"
                )

            try:
                payload = resp.json()
            except Exception as exc:
                raise RuntimeError(
                    f"Daraja auth returned non-JSON: {resp.text[:200]}"
                ) from exc

            token = payload.get("access_token")
            if not token:
                raise RuntimeError(
                    f"Daraja auth response missing access_token: {payload}"
                )

            expires_in = int(payload.get("expires_in", 3600))
            self._token = token
            self._expires_at = now + timedelta(seconds=expires_in - 60)
            return self._token


# ---------------------------------------------------------------------------
# STK Push service
# ---------------------------------------------------------------------------

class DarajaSTKService:
    """Initiates an M-Pesa STK Push via Safaricom Daraja."""

    def __init__(
        self,
        settings: Settings | None = None,
        auth: DarajaAuthService | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._auth = auth or DarajaAuthService(self._settings)

    def _timestamp(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

    def _password(self, timestamp: str) -> str:
        s = self._settings
        raw = f"{s.daraja_shortcode}{s.daraja_passkey}{timestamp}"
        return b64encode(raw.encode()).decode()

    def initiate(
        self,
        *,
        phone_number: str,
        amount: int,
        account_reference: str,
        transaction_desc: str,
    ) -> dict:
        """Send an STK Push request.

        Returns the raw Daraja response dict.
        Raises ValueError for bad inputs, RuntimeError for gateway errors.
        """
        s = self._settings
        if not s.daraja_shortcode or not s.daraja_passkey:
            raise RuntimeError(
                "DARAJA_SHORTCODE and DARAJA_PASSKEY must be set."
            )
        if not s.daraja_callback_url:
            raise RuntimeError("DARAJA_CALLBACK_URL must be set.")
        if amount < 1:
            raise ValueError("Amount must be at least KES 1.")

        phone = normalize_phone(phone_number)
        token = self._auth.get_access_token()
        ts = self._timestamp()
        password = self._password(ts)

        payload = {
            "BusinessShortCode": s.daraja_shortcode,
            "Password": password,
            "Timestamp": ts,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": amount,
            "PartyA": phone,
            "PartyB": s.daraja_shortcode,
            "PhoneNumber": phone,
            "CallBackURL": s.daraja_callback_url,
            "AccountReference": account_reference[:12],
            "TransactionDesc": transaction_desc[:13],
        }

        with httpx.Client(timeout=30.0) as client:
            try:
                resp = client.post(
                    s.daraja_stk_push_url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
            except httpx.HTTPError as exc:
                raise RuntimeError(
                    f"Daraja STK Push request failed: {exc}"
                ) from exc

        try:
            body = resp.json()
        except Exception:
            body = {"errorMessage": resp.text[:300]}

        if resp.status_code not in (200, 201):
            msg = body.get("errorMessage") or body.get("ResponseDescription") or resp.text[:200]
            raise RuntimeError(f"Daraja STK Push failed ({resp.status_code}): {msg}")

        return body

    def generate_qr_code(
        self,
        *,
        amount: float,
        ref_no: str,
        merchant_name: str,
        trx_code: str = "BG",
        size: str = "300",
    ) -> dict:
        """Generate a Safaricom Dynamic QR code.

        Returns the raw Daraja response dict containing ``QRCode`` base64 data.
        Raises ValueError for bad inputs, RuntimeError for gateway errors.
        """
        s = self._settings
        if not s.daraja_shortcode:
            raise RuntimeError("DARAJA_SHORTCODE must be set.")
        if amount <= 0:
            raise ValueError("Amount must be greater than zero.")
        if not ref_no.strip():
            raise ValueError("RefNo is required.")
        if not merchant_name.strip():
            raise ValueError("MerchantName is required.")
        if trx_code not in ("BG", "PA", "SM", "SB"):
            raise ValueError(f"Unsupported TrxCode '{trx_code}'. Use BG, PA, SM, or SB.")

        token = self._auth.get_access_token()
        cpi = s.daraja_shortcode

        payload = {
            "MerchantName": merchant_name[:10],
            "RefNo": ref_no[:20],
            "Amount": amount,
            "TrxCode": trx_code,
            "CPI": cpi,
            "Size": size,
        }

        with httpx.Client(timeout=30.0) as client:
            try:
                resp = client.post(
                    s.daraja_qr_url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
            except httpx.HTTPError as exc:
                raise RuntimeError(
                    f"Daraja QR request failed: {exc}"
                ) from exc

        try:
            body = resp.json()
        except Exception:
            body = {"errorMessage": resp.text[:300]}

        if resp.status_code != 200:
            msg = body.get("errorMessage") or body.get("ResponseDescription") or resp.text[:200]
            raise RuntimeError(f"Daraja QR failed ({resp.status_code}): {msg}")

        qr_code = body.get("QRCode")
        if not qr_code:
            raise RuntimeError("Daraja QR response missing QRCode.")

        return body


# ---------------------------------------------------------------------------
# B2B — Business Buy Goods service
# ---------------------------------------------------------------------------

class DarajaB2BService:
    """Initiates a Safaricom B2B (Business Buy Goods) payment.

    The B2B API is asynchronous:
    - The initial POST returns a ConversationID/OriginatorConversationID with
      ResponseCode 0 meaning the request was ACCEPTED, not completed.
    - Daraja later POSTs to the configured ResultURL (or QueueTimeOutURL).
    - The Cash-Flow callback handler is responsible for the final state.

    Required backend env (never exposed to the frontend):
        DARAJA_B2B_INITIATOR              - API operator username
        DARAJA_B2B_SECURITY_CREDENTIAL    - encrypted SecurityCredential
        DARAJA_B2B_PARTY_A                - sender shortcode
        DARAJA_B2B_PARTY_B                - receiver shortcode
        DARAJA_B2B_RESULT_URL             - public HTTPS callback (ResultURL)
        DARAJA_B2B_QUEUE_TIMEOUT_URL      - public HTTPS callback (QueueTimeOutURL)
    """

    def __init__(
        self,
        settings: Settings | None = None,
        auth: DarajaAuthService | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._auth = auth or DarajaAuthService(self._settings)

    def _require_configured(self) -> None:
        s = self._settings
        missing = []
        if not s.daraja_b2b_initiator:
            missing.append("DARAJA_B2B_INITIATOR")
        if not s.daraja_b2b_security_credential:
            missing.append("DARAJA_B2B_SECURITY_CREDENTIAL")
        if not s.daraja_b2b_party_a:
            missing.append("DARAJA_B2B_PARTY_A")
        if not s.daraja_b2b_party_b:
            missing.append("DARAJA_B2B_PARTY_B")
        if not s.daraja_b2b_result_url:
            missing.append("DARAJA_B2B_RESULT_URL")
        if not s.daraja_b2b_queue_timeout_url:
            missing.append("DARAJA_B2B_QUEUE_TIMEOUT_URL")
        if missing:
            raise RuntimeError(
                f"Daraja B2B not configured. Missing: {', '.join(missing)}"
            )

    def payment_request(
        self,
        *,
        amount: float,
        account_reference: str,
        party_b: str | None = None,
        requester: str | None = None,
        remarks: str = "Cash-Flow B2B",
    ) -> dict:
        """Submit a BusinessPayBill request to Daraja.

        Returns the raw Daraja response dict containing
        ``OriginatorConversationID`` and ``ConversationID`` along with
        ``ResponseCode``/``ResponseDescription``.

        Raises:
            ValueError: invalid input (amount, reference length, etc.)
            RuntimeError: Daraja gateway or configuration error.
        """
        s = self._settings
        self._require_configured()

        # Validation
        try:
            amount_int = int(amount)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Amount must be numeric, got {amount!r}") from exc
        if amount_int < 1:
            raise ValueError("Amount must be at least KES 1.")
        if not account_reference or not account_reference.strip():
            raise ValueError("AccountReference is required.")
        # Daraja enforces a 13-character limit on AccountReference
        account_ref_clean = account_reference.strip()[:13]
        if len(account_ref_clean) < 1:
            raise ValueError("AccountReference is required.")

        receiver = (party_b or s.daraja_b2b_party_b).strip()
        if not receiver:
            raise ValueError("PartyB (receiver shortcode) is required.")

        normalised_requester: str | None = None
        if requester:
            try:
                normalised_requester = normalize_phone(requester)
            except ValueError as exc:
                raise ValueError(f"Invalid requester phone: {exc}") from exc

        # Obtain a fresh access token (cached by auth service)
        token = self._auth.get_access_token()

        # Build the Daraja payload.
        # Field spelling matches the official Daraja B2B contract.
        payload: dict = {
            "Initiator": s.daraja_b2b_initiator,
            "SecurityCredential": s.daraja_b2b_security_credential,
            "CommandID": "BusinessPayBill",
            "SenderIdentifierType": "4",
            "RecieverIdentifierType": "4",
            "Amount": str(amount_int),
            "PartyA": s.daraja_b2b_party_a,
            "PartyB": receiver,
            "AccountReference": account_ref_clean,
            "Remarks": (remarks or "Cash-Flow B2B")[:100],
            "QueueTimeOutURL": s.daraja_b2b_queue_timeout_url,
            "ResultURL": s.daraja_b2b_result_url,
        }
        if normalised_requester:
            payload["Requester"] = normalised_requester

        with httpx.Client(timeout=30.0) as client:
            try:
                resp = client.post(
                    s.daraja_b2b_url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
            except httpx.HTTPError as exc:
                raise RuntimeError(
                    f"Daraja B2B request failed: {exc}"
                ) from exc

        try:
            body = resp.json()
        except Exception:
            body = {"errorMessage": resp.text[:300]}

        # The initial Daraja B2B response shape is the same as STK:
        # { "OriginatorConversationID": "...", "ConversationID": "...",
        #   "ResponseCode": "0", "ResponseDescription": "..." }
        # A 200/202 with ResponseCode "0" means ACCEPTED, not completed.
        if resp.status_code not in (200, 202):
            msg = (
                body.get("errorMessage")
                or body.get("ResponseDescription")
                or resp.text[:200]
            )
            raise RuntimeError(f"Daraja B2B failed ({resp.status_code}): {msg}")

        return body


# ---------------------------------------------------------------------------
# Module-level singletons
# ---------------------------------------------------------------------------

_auth_service: DarajaAuthService | None = None
_stk_service: DarajaSTKService | None = None
_b2b_service: DarajaB2BService | None = None


def get_auth_service() -> DarajaAuthService:
    global _auth_service
    if _auth_service is None:
        _auth_service = DarajaAuthService()
    return _auth_service


def get_stk_service() -> DarajaSTKService:
    global _stk_service
    if _stk_service is None:
        _stk_service = DarajaSTKService()
    return _stk_service


def get_b2b_service() -> "DarajaB2BService":
    global _b2b_service
    if _b2b_service is None:
        _b2b_service = DarajaB2BService(auth=get_auth_service())
    return _b2b_service
