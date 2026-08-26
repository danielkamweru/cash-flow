from __future__ import annotations

import json
from typing import Any

from app import models
from app.schemas import iso


def _parse_json_field(value):
    """jsonb columns arrive already deserialized from psycopg; text columns do not."""
    if isinstance(value, (str, bytes, bytearray)):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            return []
    return value if value is not None else []


def entity_dto(e: models.Entity) -> dict[str, Any]:
    return {
        "id": e.Id,
        "userId": e.UserId,
        "type": e.Type,
        "name": e.Name,
        "description": e.Description,
        "createdAt": iso(e.CreatedAt),
        "updatedAt": iso(e.UpdatedAt),
    }


def account_dto(a: models.Account) -> dict[str, Any]:
    return {
        "id": a.Id,
        "entityId": a.EntityId,
        "name": a.Name,
        "provider": a.Provider,
        "institution": a.Institution,
        "balance": a.Balance,
        "currency": a.Currency,
        "connectionStatus": a.ConnectionStatus,
        "provenance": a.Provenance,
        "accountMask": a.AccountMask,
        "isLiquid": a.IsLiquid,
        "lastUpdated": iso(a.LastUpdated),
        "createdAt": iso(a.CreatedAt),
    }


def transaction_dto(t: models.Transaction) -> dict[str, Any]:
    return {
        "id": t.Id,
        "entityId": t.EntityId,
        "accountId": t.AccountId,
        "date": iso(t.Date),
        "description": t.Description,
        "amount": t.Amount,
        "category": t.Category,
        "type": t.Type,
        "provenance": t.Provenance,
        "status": t.Status,
        "loopTxnReference": t.LoopTxnReference,
    }


def asset_dto(a: models.Asset) -> dict[str, Any]:
    return {
        "id": a.Id,
        "entityId": a.EntityId,
        "name": a.Name,
        "category": a.Category,
        "value": a.Value,
        "liquidity": a.Liquidity,
        "provenance": a.Provenance,
        "lastUpdated": iso(a.LastUpdated),
    }


def investment_dto(i: models.Investment) -> dict[str, Any]:
    return {
        "id": i.Id,
        "entityId": i.EntityId,
        "name": i.Name,
        "type": i.Type,
        "value": i.Value,
        "costBasis": i.CostBasis,
        "liquidity": i.Liquidity,
        "risk": i.Risk,
        "provenance": i.Provenance,
        "notes": i.Notes,
        "lastUpdated": iso(i.LastUpdated),
    }


def liability_dto(l: models.Liability) -> dict[str, Any]:
    return {
        "id": l.Id,
        "entityId": l.EntityId,
        "name": l.Name,
        "lender": l.Lender,
        "balance": l.Balance,
        "monthlyPayment": l.MonthlyPayment,
        "interestRate": l.InterestRate,
        "dueDay": l.DueDay,
        "provenance": l.Provenance,
        "lastUpdated": iso(l.LastUpdated),
    }


def obligation_dto(o: models.Obligation) -> dict[str, Any]:
    return {
        "id": o.Id,
        "entityId": o.EntityId,
        "name": o.Name,
        "amount": o.Amount,
        "dueDate": iso(o.DueDate),
        "category": o.Category,
        "status": o.Status,
    }


def goal_dto(g: models.Goal) -> dict[str, Any]:
    return {
        "id": g.Id,
        "entityId": g.EntityId,
        "name": g.Name,
        "category": g.Category,
        "target": g.Target,
        "current": g.Current,
        "deadline": iso(g.Deadline),
        "monthlyContribution": g.MonthlyContribution,
        "priority": g.Priority,
    }


def risk_profile_dto(r: models.RiskProfile) -> dict[str, Any]:
    return {
        "entityId": r.EntityId,
        "horizon": r.Horizon,
        "tolerance": r.Tolerance,
        "emergencyFundMonthsTarget": r.EmergencyFundMonthsTarget,
        "notes": r.Notes,
    }


def credit_readiness_dto(c: models.CreditReadiness) -> dict[str, Any]:
    notes = _parse_json_field(c.NotesJson)
    return {
        "entityId": c.EntityId,
        "level": c.Level,
        "incomeMonthly": c.IncomeMonthly,
        "expensesMonthly": c.ExpensesMonthly,
        "monthlySurplus": c.MonthlySurplus,
        "liquidAssets": c.LiquidAssets,
        "investments": c.Investments,
        "liabilities": c.Liabilities,
        "debtBurdenRatio": c.DebtBurdenRatio,
        "savingsConsistency": c.SavingsConsistency,
        "historyMonths": c.HistoryMonths,
        "notes": notes,
        "disclaimer": c.Disclaimer,
        "lastUpdated": iso(c.LastUpdated),
    }


def market_instrument_dto(m: models.MarketInstrument) -> dict[str, Any]:
    return {
        "id": m.Id,
        "type": m.Type,
        "name": m.Name,
        "provider": m.Provider,
        "yieldLabel": m.YieldLabel,
        "yieldValue": m.YieldValue,
        "risk": m.Risk,
        "liquidity": m.Liquidity,
        "minInvestment": m.MinInvestment,
        "dataStatus": m.DataStatus,
        "asOf": iso(m.AsOf),
        "notes": m.Notes,
    }


def provider_dto(p: models.Provider) -> dict[str, Any]:
    capabilities = _parse_json_field(p.Capabilities)
    return {
        "id": p.Id,
        "name": p.Name,
        "category": p.Category,
        "status": p.Status,
        "description": p.Description,
        "capabilities": capabilities,
    }


def automation_rule_dto(a: models.AutomationRule) -> dict[str, Any]:
    return {
        "id": a.Id,
        "entityId": a.EntityId,
        "name": a.Name,
        "description": a.Description,
        "status": a.Status,
        "trigger": a.Trigger,
        "action": a.Action,
        "targetGoalId": a.TargetGoalId,
        "triggerSpec": a.TriggerSpec,
        "actionSpec": a.ActionSpec,
        "autoApprove": bool(a.AutoApprove),
        "authorizedAt": iso(a.AuthorizedAt),
        "executedAt": iso(a.ExecutedAt),
        "lastRunAt": iso(a.LastRunAt),
        "nextRunAt": iso(a.NextRunAt),
    }


def rule_run_dto(r: models.RuleRun) -> dict[str, Any]:
    return {
        "id": r.Id,
        "ruleId": r.RuleId,
        "entityId": r.EntityId,
        "triggeredAt": iso(r.TriggeredAt),
        "outcome": r.Outcome,
        "runMode": r.RunMode,
        "proposedAmount": round(r.ProposedAmount, 2) if r.ProposedAmount is not None else None,
        "txnReference": r.TxnReference,
        "error": r.Error,
        "detail": r.Detail,
    }


def activity_event_dto(a: models.ActivityEvent) -> dict[str, Any]:
    return {
        "id": a.Id,
        "entityId": a.EntityId,
        "timestamp": iso(a.Timestamp),
        "title": a.Title,
        "detail": a.Detail,
        "kind": a.Kind,
    }


def supplier_dto(s: models.Supplier, agreements: list[models.BnplAgreement] | None = None) -> dict[str, Any]:
    return {
        "id": s.Id,
        "entityId": s.EntityId,
        "name": s.Name,
        "trustScore": s.TrustScore,
        "paybillOrTill": s.PaybillOrTill,
        "paymentHistory": _parse_json_field(s.PaymentHistory) or {},
        "agreements": [bnpl_dto(a) for a in (agreements or [])],
    }


def bnpl_dto(a: models.BnplAgreement) -> dict[str, Any]:
    return {
        "id": a.Id,
        "supplierId": a.SupplierId,
        "principal": a.Principal,
        "balance": a.Balance,
        "status": a.Status,
        "installments": _parse_json_field(a.InstallmentSchedule) or [],
    }


def profile_member_dto(m: models.ProfileMember, user: models.User | None = None) -> dict[str, Any]:
    return {
        "id": m.Id,
        "entityId": m.EntityId,
        "userId": m.UserId,
        "role": m.Role,
        "joinedAt": iso(m.JoinedAt),
        "name": user.Name if user else None,
    }


def business_details_dto(b: models.BusinessProfileDetails) -> dict[str, Any]:
    return {
        "entityId": b.EntityId,
        "registrationNumber": b.RegistrationNumber,
        "kraPin": b.KraPin,
        "businessType": b.BusinessType,
        "registeredAt": iso(b.RegisteredAt),
    }
