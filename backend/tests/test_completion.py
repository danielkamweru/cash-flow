"""Tests for STK Push ledger completion — settle, reversal, and scheduling."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from app.daraja.completion import (
    REVERSAL_DELAY_SECONDS,
    reverse_stk,
    schedule_reversal,
    settle_stk,
)
from app import models


# ---------------------------------------------------------------------------
# Test doubles
# ---------------------------------------------------------------------------

class FakeTransaction:
    """Lightweight stand-in for a Transaction model row."""

    def __init__(
        self,
        id: str,
        amount: float,
        account_id: str,
        entity_id: str,
        status: str = "completed",
        description: str = "M-Pesa STK Push — CASHFLOW",
        category: str = "M-Pesa",
        txn_type: str = "inflow",
        payment_ref: str | None = None,
        metadata: dict | None = None,
    ):
        self.Id = id
        self.Amount = amount
        self.AccountId = account_id
        self.EntityId = entity_id
        self.Status = status
        self.Description = description
        self.Category = category
        self.Type = txn_type
        self.PaymentReference = payment_ref or f"CR-{id}"
        self.Metadata = metadata or {}

    def describe(self) -> str:
        return f"FakeTransaction(id={self.Id}, amount={self.Amount}, status={self.Status})"


class FakeAccount:
    def __init__(self, id: str, balance: float):
        self.Id = id
        self.Balance = balance
        self.LastUpdated = None


def make_mock_db(accounts: dict[str, FakeAccount] | None = None) -> MagicMock:
    """Build a MagicMock Session whose query/filter/order_by chain returns
    a configurable list from ``.all()``, and whose ``get`` returns real
    FakeAccount objects so balance arithmetic is observable."""
    accounts = accounts or {}
    db = MagicMock(spec=Session)

    # The query chain: db.query().filter().order_by().filter()...all()
    query_mock = MagicMock()
    query_mock.all.return_value = []
    query_mock.filter.return_value = query_mock
    query_mock.order_by.return_value = query_mock
    db.query.return_value = query_mock

    def _get(model, pk):
        if model is models.Account:
            return accounts.get(pk)
        return None

    db.get.side_effect = _get
    db._accounts = accounts  # stash for tests
    db._query_mock = query_mock
    return db


# ---------------------------------------------------------------------------
# reverse_stk
# ---------------------------------------------------------------------------

class TestReverseStk:
    def test_reverses_completed_inflows_largest_first(self):
        """Two completed inflows (1 bob + 10 bob) must be reversed 10 → 1."""
        acct = FakeAccount("acct-1", 113.0)  # 100 + 10 + 1 + 2(other)
        db = make_mock_db(accounts={"acct-1": acct})

        tx_small = FakeTransaction("tx-1", 1.0, "acct-1", "ent-1", payment_ref="CR-001")
        tx_large = FakeTransaction("tx-2", 10.0, "acct-1", "ent-1", payment_ref="CR-002")
        db._query_mock.all.return_value = [tx_small, tx_large]

        # Track reversal order
        reversal_order: list[str] = []

        def fake_desc():
            pass

        original_desc = tx_large.describe
        tx_small.reversal_done = False
        tx_large.reversal_done = False

        # We'll observe order by having reverse_stk process them — since it
        # orders by Amount.desc(), the query result must already be
        # pre-sorted (the mock returns what we set up).  We configure the
        # mock to return [large, small] to simulate the .order_by().desc().
        db._query_mock.all.return_value = [tx_large, tx_small]

        reversed_txs = reverse_stk(db, entity_id="ent-1")

        assert len(reversed_txs) == 2
        # First reversed is the 10 bob (largest)
        assert reversed_txs[0].Amount == 10.0
        assert reversed_txs[1].Amount == 1.0
        # Both marked reversed
        assert tx_large.Status == "reversed"
        assert tx_small.Status == "reversed"
        # Balance credited back: 113 - 10 - 1 = 102
        assert acct.Balance == pytest.approx(102.0)
        # Descriptions annotated
        assert "reversed" in tx_large.Description

    def test_reverses_specific_checkout_request(self):
        """When checkout_request_id is given, only that txn is reversed."""
        acct = FakeAccount("acct-1", 111.0)  # 100 + 10 + 1
        db = make_mock_db(accounts={"acct-1": acct})

        tx_10 = FakeTransaction("tx-10", 10.0, "acct-1", "ent-1", payment_ref="CR-10")
        tx_1 = FakeTransaction("tx-1", 1.0, "acct-1", "ent-1", payment_ref="CR-01")
        # DB query with checkout_request_id filter returns only CR-01
        db._query_mock.all.return_value = [tx_1]

        reversed_txs = reverse_stk(
            db, entity_id="ent-1", checkout_request_id="CR-01"
        )

        assert len(reversed_txs) == 1
        assert reversed_txs[0].Id == "tx-1"
        assert tx_1.Status == "reversed"
        # The 10 bob is untouched
        assert tx_10.Status == "completed"
        # Only 1 bob reversed
        assert acct.Balance == pytest.approx(110.0)

    def test_skips_non_completed_and_already_reversed(self):
        """Only 'completed' status rows are eligible for reversal."""
        acct = FakeAccount("acct-1", 111.0)
        db = make_mock_db(accounts={"acct-1": acct})

        tx_pending = FakeTransaction("tx-p", 5.0, "acct-1", "ent-1", status="pending")
        tx_failed = FakeTransaction("tx-f", 3.0, "acct-1", "ent-1", status="failed")
        tx_reversed = FakeTransaction("tx-r", 7.0, "acct-1", "ent-1", status="reversed")
        db._query_mock.all.return_value = [tx_pending, tx_failed, tx_reversed]

        reversed_txs = reverse_stk(db, entity_id="ent-1")

        assert len(reversed_txs) == 0
        assert tx_pending.Status == "pending"
        assert tx_failed.Status == "failed"
        assert tx_reversed.Status == "reversed"
        assert acct.Balance == pytest.approx(111.0)  # unchanged

    def test_no_transactions_returns_empty_list(self):
        db = make_mock_db(accounts={"acct-1": FakeAccount("acct-1", 100.0)})
        db._query_mock.all.return_value = []

        result = reverse_stk(db, entity_id="ent-1")

        assert result == []

    def test_metadata_records_reversal(self):
        acct = FakeAccount("acct-1", 110.0)
        db = make_mock_db(accounts={"acct-1": acct})

        tx = FakeTransaction("tx-1", 10.0, "acct-1", "ent-1")
        db._query_mock.all.return_value = [tx]

        reversed_txs = reverse_stk(db, entity_id="ent-1")

        assert len(reversed_txs) == 1
        assert "reversed_at" in tx.Metadata
        assert tx.Metadata["reversal_reason"] == "sandbox_simulated_no_storage"


# ---------------------------------------------------------------------------
# schedule_reversal — sandboxing behaviour
# ---------------------------------------------------------------------------

class TestScheduleReversal:
    @patch("app.daraja.completion._reversal_worker")
    @patch("app.daraja.completion.get_settings")
    def test_schedules_timer_in_sandbox(self, mock_settings, mock_worker):
        mock_settings.return_value = MagicMock(
            is_sandbox=True, daraja_simulated_reversal_seconds=5
        )
        mock_timer_cls = MagicMock()
        with patch("app.daraja.completion.threading.Timer", mock_timer_cls):
            timer = schedule_reversal(entity_id="ent-1", delay=5.0)

        assert timer is not None
        mock_timer_cls.assert_called_once()
        args, kwargs = mock_timer_cls.call_args
        # delay is the first positional arg
        assert args[0] == 5.0
        # _reversal_worker is the callable
        assert args[1] is mock_worker
        mock_timer_cls.return_value.start.assert_called_once()

    @patch("app.daraja.completion._reversal_worker")
    @patch("app.daraja.completion.get_settings")
    def test_returns_none_when_not_sandbox(self, mock_settings, mock_worker):
        mock_settings.return_value = MagicMock(
            is_sandbox=False, daraja_simulated_reversal_seconds=5
        )
        result = schedule_reversal(entity_id="ent-1")
        assert result is None

    @patch("app.daraja.completion._reversal_worker")
    @patch("app.daraja.completion.get_settings")
    def test_returns_none_when_delay_zero(self, mock_settings, mock_worker):
        mock_settings.return_value = MagicMock(
            is_sandbox=True, daraja_simulated_reversal_seconds=0
        )
        result = schedule_reversal(entity_id="ent-1")
        assert result is None


# ---------------------------------------------------------------------------
# settle_stk — reversal wiring
# ---------------------------------------------------------------------------

class TestSettleStkWithReversal:
    @patch("app.daraja.completion.schedule_reversal")
    def test_settle_stk_success_schedules_reversal(self, mock_schedule):
        db = MagicMock(spec=Session)
        tx = FakeTransaction("tx-1", 10.0, "acct-1", "ent-1", status="pending", payment_ref="CR-001")
        db.query.return_value.filter.return_value.one_or_none.return_value = tx
        db.get.return_value = FakeAccount("acct-1", 100.0)
        mock_schedule.return_value = MagicMock()

        result = settle_stk(
            db,
            checkout_request_id="CR-001",
            success=True,
            mpesa_receipt="RCPT-123",
        )

        assert result is tx
        assert tx.Status == "completed"
        mock_schedule.assert_called_once()
        _, kwargs = mock_schedule.call_args
        assert kwargs["entity_id"] == "ent-1"
        assert kwargs["account_id"] == "acct-1"
        assert kwargs["checkout_request_id"] == "CR-001"

    @patch("app.daraja.completion.schedule_reversal")
    def test_settle_stk_failure_does_not_schedule(self, mock_schedule):
        db = MagicMock(spec=Session)
        tx = FakeTransaction("tx-1", 10.0, "acct-1", "ent-1", status="pending")
        db.query.return_value.filter.return_value.one_or_none.return_value = tx
        db.get.return_value = FakeAccount("acct-1", 100.0)

        result = settle_stk(
            db,
            checkout_request_id="CR-001",
            success=False,
        )

        assert tx.Status == "failed"
        mock_schedule.assert_not_called()

    @patch("app.daraja.completion.schedule_reversal")
    def test_settle_stk_idempotent_when_already_settled(self, mock_schedule):
        db = MagicMock(spec=Session)
        tx = FakeTransaction("tx-1", 10.0, "acct-1", "ent-1", status="completed", payment_ref="CR-001")
        db.query.return_value.filter.return_value.one_or_none.return_value = tx
        db.get.return_value = FakeAccount("acct-1", 100.0)

        result = settle_stk(
            db,
            checkout_request_id="CR-001",
            success=True,
        )

        assert result is tx
        assert tx.Status == "completed"  # unchanged
        mock_schedule.assert_not_called()
