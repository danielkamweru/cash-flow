from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        ser_json_timedelta="iso8601",
    )


class LoopPromptRequest(CamelModel):
    mobile_no: str
    amount: str
    reason: str
    callback_url: str | None = None
    till: str | None = None
    entity_id: str | None = None
    account_id: str | None = None


class MpesaPromptRequest(CamelModel):
    pay_mbl_no: str
    amount: str
    ext_ref_no: str
    callback_url: str | None = None
    till: str | None = None
    entity_id: str | None = None
    account_id: str | None = None


class TransactionInquiryRequest(CamelModel):
    txn_reference: str
    till: str | None = None


class TransactionHistoryRequest(CamelModel):
    limit: int
    till: str | None = None


class PayToTillRequest(CamelModel):
    merchant_rcv_till: str
    account_number: str
    amount: str
    till: str | None = None
    entity_id: str | None = None
    account_id: str | None = None
    liability_id: str | None = None
    obligation_id: str | None = None


class SendMoneyRequest(CamelModel):
    recipient_mobile_no: str
    amount: str
    purpose_of_payment: str
    till: str | None = None
    entity_id: str | None = None
    account_id: str | None = None
    goal_id: str | None = None
    automation_rule_id: str | None = None
    # Required for the MPESA and PESALINK channels only.
    pin: str | None = None


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.isoformat() + "Z"
    return dt.isoformat().replace("+00:00", "Z")


JsonDict = dict[str, Any]
