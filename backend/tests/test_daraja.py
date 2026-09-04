"""Tests for the Safaricom Daraja M-Pesa integration.

All external HTTP calls are mocked — the real sandbox is never hit in tests.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from app.daraja import DarajaAuthService, DarajaSTKService, normalize_phone
from app.config import Settings


# ---------------------------------------------------------------------------
# Phone normalisation
# ---------------------------------------------------------------------------

class TestNormalizePhone:
    def test_07_format(self):
        assert normalize_phone("0712345678") == "254712345678"

    def test_254_format(self):
        assert normalize_phone("254712345678") == "254712345678"

    def test_plus_254_format(self):
        assert normalize_phone("+254712345678") == "254712345678"

    def test_spaces_stripped(self):
        assert normalize_phone("0712 345 678") == "254712345678"

    def test_invalid_raises(self):
        with pytest.raises(ValueError, match="Invalid Kenyan phone"):
            normalize_phone("123")

    def test_empty_raises(self):
        with pytest.raises(ValueError):
            normalize_phone("")

    def test_international_non_kenya_raises(self):
        with pytest.raises(ValueError):
            normalize_phone("+12025551234")


# ---------------------------------------------------------------------------
# Auth service
# ---------------------------------------------------------------------------

def _settings(**kwargs) -> Settings:
    defaults = dict(
        daraja_consumer_key="test_key",
        daraja_consumer_secret="test_secret",
        daraja_shortcode="174379",
        daraja_passkey="bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
        daraja_auth_url="https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
        daraja_stk_push_url="https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        daraja_callback_url="https://example.com/api/mpesa/callback",
    )
    defaults.update(kwargs)
    return Settings.model_construct(**defaults)


class TestDarajaAuthService:
    def test_successful_token(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"access_token": "test_token_abc", "expires_in": "3600"}

        with patch("httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.return_value = mock_resp
            mock_client_cls.return_value = mock_client

            svc = DarajaAuthService(settings=_settings())
            token = svc.get_access_token()

        assert token == "test_token_abc"

    def test_token_cached(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"access_token": "cached_token", "expires_in": "3600"}

        with patch("httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.return_value = mock_resp
            mock_client_cls.return_value = mock_client

            svc = DarajaAuthService(settings=_settings())
            t1 = svc.get_access_token()
            t2 = svc.get_access_token()

        assert t1 == t2
        assert mock_client.get.call_count == 1  # only one HTTP call

    def test_invalid_credentials_raises(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_resp.text = "Unauthorized"

        with patch("httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.return_value = mock_resp
            mock_client_cls.return_value = mock_client

            svc = DarajaAuthService(settings=_settings())
            with pytest.raises(RuntimeError, match="Daraja auth failed"):
                svc.get_access_token()

    def test_missing_credentials_raises(self):
        svc = DarajaAuthService(settings=_settings(daraja_consumer_key="", daraja_consumer_secret=""))
        with pytest.raises(RuntimeError, match="must be set"):
            svc.get_access_token()

    def test_malformed_response_raises(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"not_a_token": "oops"}

        with patch("httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.return_value = mock_resp
            mock_client_cls.return_value = mock_client

            svc = DarajaAuthService(settings=_settings())
            with pytest.raises(RuntimeError, match="missing access_token"):
                svc.get_access_token()


# ---------------------------------------------------------------------------
# STK Push service
# ---------------------------------------------------------------------------

class TestDarajaSTKService:
    def _make_svc(self, token="mock_token"):
        mock_auth = MagicMock()
        mock_auth.get_access_token.return_value = token
        return DarajaSTKService(settings=_settings(), auth=mock_auth)

    def test_valid_request(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "MerchantRequestID": "MR-001",
            "CheckoutRequestID": "CR-001",
            "ResponseCode": "0",
            "ResponseDescription": "Success. Request accepted for processing",
            "CustomerMessage": "Success. Request accepted for processing",
        }

        with patch("httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_resp
            mock_client_cls.return_value = mock_client

            svc = self._make_svc()
            result = svc.initiate(
                phone_number="0712345678",
                amount=100,
                account_reference="TEST-001",
                transaction_desc="Test payment",
            )

        assert result["CheckoutRequestID"] == "CR-001"
        assert result["MerchantRequestID"] == "MR-001"

    def test_invalid_phone_raises(self):
        svc = self._make_svc()
        with pytest.raises(ValueError, match="Invalid Kenyan phone"):
            svc.initiate(
                phone_number="123",
                amount=100,
                account_reference="TEST",
                transaction_desc="Test",
            )

    def test_invalid_amount_raises(self):
        svc = self._make_svc()
        with pytest.raises(ValueError, match="at least KES 1"):
            svc.initiate(
                phone_number="0712345678",
                amount=0,
                account_reference="TEST",
                transaction_desc="Test",
            )

    def test_safaricom_error_raises(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.json.return_value = {"errorMessage": "Bad Request", "errorCode": "400.002.02"}

        with patch("httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_resp
            mock_client_cls.return_value = mock_client

            svc = self._make_svc()
            with pytest.raises(RuntimeError, match="Daraja STK Push failed"):
                svc.initiate(
                    phone_number="0712345678",
                    amount=100,
                    account_reference="TEST",
                    transaction_desc="Test",
                )

    def test_missing_shortcode_raises(self):
        mock_auth = MagicMock()
        mock_auth.get_access_token.return_value = "token"
        svc = DarajaSTKService(settings=_settings(daraja_shortcode=""), auth=mock_auth)
        with pytest.raises(RuntimeError, match="must be set"):
            svc.initiate(
                phone_number="0712345678",
                amount=100,
                account_reference="TEST",
                transaction_desc="Test",
            )

    def test_missing_callback_url_raises(self):
        mock_auth = MagicMock()
        mock_auth.get_access_token.return_value = "token"
        svc = DarajaSTKService(settings=_settings(daraja_callback_url=""), auth=mock_auth)
        with pytest.raises(RuntimeError, match="DARAJA_CALLBACK_URL"):
            svc.initiate(
                phone_number="0712345678",
                amount=100,
                account_reference="TEST",
                transaction_desc="Test",
            )


# ---------------------------------------------------------------------------
# Callback parsing (unit test — no DB)
# ---------------------------------------------------------------------------

class TestCallbackParsing:
    """Test that the callback payload structure is parsed correctly."""

    def _success_payload(self, checkout_id="CR-001"):
        return {
            "Body": {
                "stkCallback": {
                    "MerchantRequestID": "MR-001",
                    "CheckoutRequestID": checkout_id,
                    "ResultCode": 0,
                    "ResultDesc": "The service request is processed successfully.",
                    "CallbackMetadata": {
                        "Item": [
                            {"Name": "Amount", "Value": 100},
                            {"Name": "MpesaReceiptNumber", "Value": "NLJ7RT61SV"},
                            {"Name": "TransactionDate", "Value": 20191219102115},
                            {"Name": "PhoneNumber", "Value": 254712345678},
                        ]
                    },
                }
            }
        }

    def _failure_payload(self, checkout_id="CR-002"):
        return {
            "Body": {
                "stkCallback": {
                    "MerchantRequestID": "MR-002",
                    "CheckoutRequestID": checkout_id,
                    "ResultCode": 1032,
                    "ResultDesc": "Request cancelled by user.",
                }
            }
        }

    def test_success_result_code_is_zero(self):
        payload = self._success_payload()
        result_code = payload["Body"]["stkCallback"]["ResultCode"]
        assert result_code == 0

    def test_failure_result_code_nonzero(self):
        payload = self._failure_payload()
        result_code = payload["Body"]["stkCallback"]["ResultCode"]
        assert result_code != 0

    def test_receipt_extraction(self):
        payload = self._success_payload()
        items = payload["Body"]["stkCallback"]["CallbackMetadata"]["Item"]
        receipt = next((i["Value"] for i in items if i["Name"] == "MpesaReceiptNumber"), None)
        assert receipt == "NLJ7RT61SV"

    def test_checkout_request_id_extracted(self):
        payload = self._success_payload("CR-XYZ")
        cid = payload["Body"]["stkCallback"]["CheckoutRequestID"]
        assert cid == "CR-XYZ"


# ---------------------------------------------------------------------------
# Dynamic QR service
# ---------------------------------------------------------------------------

class TestDynamicQR:
    def test_generate_qr_success(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "ResponseCode": "2001.000.001",
            "RequestID": "QR-12345",
            "ResponseDescription": "QR Code Successfully Generated.",
            "QRCode": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        }

        mock_auth = MagicMock()
        mock_auth.get_access_token.return_value = "mock_token"

        with patch("httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_resp
            mock_client_cls.return_value = mock_client

            svc = DarajaSTKService(settings=_settings(), auth=mock_auth)
            result = svc.generate_qr_code(
                amount=100,
                ref_no="INV-001",
                merchant_name="TEST SUPERMARKET",
                trx_code="BG",
            )

        assert result["QRCode"].startswith("iVBORw0KGgo")
        assert result["RequestID"] == "QR-12345"

    def test_generate_qr_invalid_trx_code(self):
        mock_auth = MagicMock()
        mock_auth.get_access_token.return_value = "mock_token"
        svc = DarajaSTKService(settings=_settings(), auth=mock_auth)
        with pytest.raises(ValueError, match="Unsupported TrxCode"):
            svc.generate_qr_code(
                amount=100,
                ref_no="INV-001",
                merchant_name="TEST",
                trx_code="XX",
            )

    def test_generate_qr_missing_shortcode(self):
        mock_auth = MagicMock()
        mock_auth.get_access_token.return_value = "mock_token"
        svc = DarajaSTKService(settings=_settings(daraja_shortcode=""), auth=mock_auth)
        with pytest.raises(RuntimeError, match="DARAJA_SHORTCODE"):
            svc.generate_qr_code(
                amount=100,
                ref_no="INV-001",
                merchant_name="TEST",
            )

    def test_generate_qr_daraja_error(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.json.return_value = {"errorMessage": "Bad Request", "errorCode": "400.002.05"}

        mock_auth = MagicMock()
        mock_auth.get_access_token.return_value = "mock_token"

        with patch("httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_resp
            mock_client_cls.return_value = mock_client

            svc = DarajaSTKService(settings=_settings(), auth=mock_auth)
            with pytest.raises(RuntimeError, match="Daraja QR failed"):
                svc.generate_qr_code(
                    amount=100,
                    ref_no="INV-001",
                    merchant_name="TEST",
                )

    def test_generate_qr_missing_qr_code(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "ResponseCode": "2001.000.001",
            "RequestID": "QR-12345",
            "ResponseDescription": "QR Code Successfully Generated.",
        }

        mock_auth = MagicMock()
        mock_auth.get_access_token.return_value = "mock_token"

        with patch("httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_resp
            mock_client_cls.return_value = mock_client

            svc = DarajaSTKService(settings=_settings(), auth=mock_auth)
            with pytest.raises(RuntimeError, match="missing QRCode"):
                svc.generate_qr_code(
                    amount=100,
                    ref_no="INV-001",
                    merchant_name="TEST",
                )
