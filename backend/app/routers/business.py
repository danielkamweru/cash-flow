"""Business working capital: suppliers you owe, and invoices owed to you.

Both sides route through LOOP. Paying a supplier uses Pay to Paybill or Pay to
M-Pesa Till depending on what they accept; collecting an invoice pushes an STK
or LOOP prompt to the customer, and the pending transaction that creates settles
itself from the callback — which is what reconciles the invoice.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import Field
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.config import loop_callback_url
from app.db import get_db
from app.loop import (
    LOOP_PROMPT,
    MPESA_PROMPT,
    PAY_TO_MPESA_TILL,
    PAY_TO_PAYBILL,
    get_gateway,
)
from app.loop.completion import is_success, record_completed_payment, track_pending_topup
from app.mappers import bnpl_dto, supplier_dto, transaction_dto
from app.schemas import CamelModel

router = APIRouter(prefix="/api/entities/{entity_id}/business")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _own(db: Session, entity_id: str, user: models.User) -> models.Entity | None:
    entity = db.get(models.Entity, entity_id)
    if entity is None or entity.UserId != user.Id:
        return None
    return entity


def invoice_dto(i: models.Invoice) -> dict:
    outstanding = max(0.0, (i.Amount or 0) - (i.AmountPaid or 0))
    overdue = i.Status not in ("paid", "cancelled") and i.DueDate is not None and i.DueDate < _now()
    days_overdue = (_now() - i.DueDate).days if overdue else 0
    return {
        "id": i.Id,
        "entityId": i.EntityId,
        "number": i.Number,
        "customerName": i.CustomerName,
        "customerPhone": i.CustomerPhone,
        "amount": i.Amount,
        "amountPaid": i.AmountPaid,
        "outstanding": outstanding,
        "issuedAt": i.IssuedAt.isoformat().replace("+00:00", "Z") if i.IssuedAt else None,
        "dueDate": i.DueDate.isoformat().replace("+00:00", "Z") if i.DueDate else None,
        "status": "overdue" if overdue else i.Status,
        "daysOverdue": days_overdue,
        "notes": i.Notes,
        "lineItems": i.LineItems or [],
        "loopTxnReference": i.LoopTxnReference,
    }


# ---------------------------------------------------------------------------
# Suppliers
# ---------------------------------------------------------------------------


class SupplierIn(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    paybill_or_till: str | None = None
    trust_score: float = 50


class SupplierPatch(CamelModel):
    name: str | None = None
    paybill_or_till: str | None = None
    trust_score: float | None = None


class SupplierPayment(CamelModel):
    account_id: str
    amount: float = Field(gt=0)
    channel: str = "paybill"          # paybill | mpesa-till
    account_number: str | None = None
    bnpl_agreement_id: str | None = None


@router.get("/suppliers")
def list_suppliers(
    entity_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _own(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    suppliers = db.query(models.Supplier).filter(models.Supplier.EntityId == entity_id).all()
    agreements = (
        db.query(models.BnplAgreement)
        .filter(models.BnplAgreement.SupplierId.in_([s.Id for s in suppliers]))
        .all()
        if suppliers
        else []
    )
    return [supplier_dto(s, [a for a in agreements if a.SupplierId == s.Id]) for s in suppliers]


@router.post("/suppliers", status_code=201)
def create_supplier(
    entity_id: str,
    body: SupplierIn,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _own(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    supplier = models.Supplier(
        EntityId=entity_id,
        Name=body.name,
        PaybillOrTill=body.paybill_or_till,
        TrustScore=body.trust_score,
        PaymentHistory={"onTimePayments": 0, "latePayments": 0, "averageDays": 0},
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier_dto(supplier, [])


@router.patch("/suppliers/{supplier_id}")
def update_supplier(
    entity_id: str,
    supplier_id: str,
    body: SupplierPatch,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _own(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    supplier = db.get(models.Supplier, supplier_id)
    if supplier is None or supplier.EntityId != entity_id:
        return JSONResponse(status_code=404, content={"error": "Supplier not found"})
    for field, value in body.model_dump(exclude_unset=True).items():
        attr = "".join(p.title() for p in field.split("_"))
        if hasattr(supplier, attr):
            setattr(supplier, attr, value)
    db.commit()
    db.refresh(supplier)
    return supplier_dto(supplier, [])


@router.delete("/suppliers/{supplier_id}")
def delete_supplier(
    entity_id: str,
    supplier_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _own(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    supplier = db.get(models.Supplier, supplier_id)
    if supplier is None or supplier.EntityId != entity_id:
        return JSONResponse(status_code=404, content={"error": "Supplier not found"})
    db.delete(supplier)
    db.commit()
    return {"ok": True, "id": supplier_id}


@router.post("/suppliers/{supplier_id}/pay")
def pay_supplier(
    entity_id: str,
    supplier_id: str,
    body: SupplierPayment,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Settle a supplier over LOOP, and draw down a BNPL agreement if given."""
    if _own(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})

    supplier = db.get(models.Supplier, supplier_id)
    if supplier is None or supplier.EntityId != entity_id:
        return JSONResponse(status_code=404, content={"error": "Supplier not found"})
    account = db.get(models.Account, body.account_id)
    if account is None or account.EntityId != entity_id:
        return JSONResponse(status_code=404, content={"error": "Account not found"})
    if account.Balance < body.amount:
        return JSONResponse(status_code=400, content={
            "error": f"Not enough in {account.Name} — balance is {account.Balance:,.2f}"})

    till = supplier.PaybillOrTill
    if not till:
        return JSONResponse(status_code=400, content={
            "error": f"{supplier.Name} has no paybill or till number saved"})

    product = PAY_TO_PAYBILL if body.channel == "paybill" else PAY_TO_MPESA_TILL
    result = get_gateway().send(product, {
        "merchantRcvTill": till,
        "accountNumber": body.account_number or till,
        "amount": f"{body.amount:.2f}",
    })
    if not is_success(result):
        return JSONResponse(status_code=502, content={
            "error": "LOOP did not accept the payment",
            "loop": {"statusCode": result.get("statusCode"), "message": result.get("message")}})

    tx = record_completed_payment(
        db,
        entity_id=entity_id,
        account_id=account.Id,
        amount=body.amount,
        txn_reference=result["txnReference"],
        description=f"Supplier payment — {supplier.Name}",
        category="Suppliers",
    )

    if body.bnpl_agreement_id:
        agreement = db.get(models.BnplAgreement, body.bnpl_agreement_id)
        if agreement is not None and agreement.SupplierId == supplier_id:
            agreement.Balance = max(0.0, agreement.Balance - body.amount)
            if agreement.Balance == 0:
                agreement.Status = "settled"
            db.commit()

    # Paying on time is what a trust score should actually reflect.
    history = dict(supplier.PaymentHistory or {})
    history["onTimePayments"] = int(history.get("onTimePayments", 0)) + 1
    supplier.PaymentHistory = history
    on_time = history["onTimePayments"]
    late = int(history.get("latePayments", 0))
    supplier.TrustScore = round(100 * on_time / max(1, on_time + late), 1)
    db.commit()
    db.refresh(supplier)

    return {
        "ok": True,
        "supplier": supplier_dto(supplier, []),
        "transaction": transaction_dto(tx),
        "accountBalance": account.Balance,
        "loop": {"txnReference": result.get("txnReference")},
    }


# ---------------------------------------------------------------------------
# Invoices / receivables
# ---------------------------------------------------------------------------


class InvoiceIn(CamelModel):
    number: str | None = None
    customer_name: str = Field(min_length=1, max_length=120)
    customer_phone: str | None = None
    amount: float = Field(gt=0)
    due_date: datetime | None = None
    notes: str | None = None
    line_items: list[dict] | None = None


class InvoicePatch(CamelModel):
    customer_name: str | None = None
    customer_phone: str | None = None
    amount: float | None = None
    due_date: datetime | None = None
    status: str | None = None
    notes: str | None = None


class InvoiceCollect(CamelModel):
    """Push a payment prompt to the customer for what is still outstanding."""

    account_id: str
    channel: str = "mpesa"        # mpesa (STK) | loop (request-to-pay)
    amount: float | None = None   # defaults to the outstanding balance
    phone: str | None = None      # defaults to the invoice's customer phone


@router.get("/invoices")
def list_invoices(
    entity_id: str,
    status: str | None = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _own(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    q = db.query(models.Invoice).filter(models.Invoice.EntityId == entity_id)
    if status:
        q = q.filter(models.Invoice.Status == status)
    return [invoice_dto(i) for i in q.order_by(models.Invoice.DueDate).all()]


@router.get("/receivables/ageing")
def receivables_ageing(
    entity_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Standard 0–30 / 31–60 / 61–90 / 90+ ageing on unpaid invoices."""
    if _own(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})

    buckets = {"current": 0.0, "d1_30": 0.0, "d31_60": 0.0, "d61_90": 0.0, "d90_plus": 0.0}
    now = _now()
    unpaid = (
        db.query(models.Invoice)
        .filter(models.Invoice.EntityId == entity_id)
        .filter(models.Invoice.Status.notin_(["paid", "cancelled"]))
        .all()
    )
    for inv in unpaid:
        outstanding = max(0.0, (inv.Amount or 0) - (inv.AmountPaid or 0))
        if outstanding <= 0 or inv.DueDate is None:
            continue
        overdue_days = (now - inv.DueDate).days
        if overdue_days <= 0:
            buckets["current"] += outstanding
        elif overdue_days <= 30:
            buckets["d1_30"] += outstanding
        elif overdue_days <= 60:
            buckets["d31_60"] += outstanding
        elif overdue_days <= 90:
            buckets["d61_90"] += outstanding
        else:
            buckets["d90_plus"] += outstanding

    total = sum(buckets.values())
    return {
        "entityId": entity_id,
        "buckets": {k: round(v, 2) for k, v in buckets.items()},
        "totalOutstanding": round(total, 2),
        "invoiceCount": len(unpaid),
    }


@router.post("/invoices", status_code=201)
def create_invoice(
    entity_id: str,
    body: InvoiceIn,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _own(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})

    count = db.query(models.Invoice).filter(models.Invoice.EntityId == entity_id).count()
    invoice = models.Invoice(
        EntityId=entity_id,
        Number=body.number or f"INV-{count + 1:04d}",
        CustomerName=body.customer_name,
        CustomerPhone=body.customer_phone,
        Amount=body.amount,
        AmountPaid=0.0,
        IssuedAt=_now(),
        DueDate=body.due_date or (_now() + timedelta(days=30)),
        Status="draft",
        Notes=body.notes,
        LineItems=body.line_items or [],
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice_dto(invoice)


@router.patch("/invoices/{invoice_id}")
def update_invoice(
    entity_id: str,
    invoice_id: str,
    body: InvoicePatch,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _own(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    invoice = db.get(models.Invoice, invoice_id)
    if invoice is None or invoice.EntityId != entity_id:
        return JSONResponse(status_code=404, content={"error": "Invoice not found"})
    for field, value in body.model_dump(exclude_unset=True).items():
        attr = "".join(p.title() for p in field.split("_"))
        if hasattr(invoice, attr):
            setattr(invoice, attr, value)
    db.commit()
    db.refresh(invoice)
    return invoice_dto(invoice)


@router.delete("/invoices/{invoice_id}")
def delete_invoice(
    entity_id: str,
    invoice_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _own(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    invoice = db.get(models.Invoice, invoice_id)
    if invoice is None or invoice.EntityId != entity_id:
        return JSONResponse(status_code=404, content={"error": "Invoice not found"})
    db.delete(invoice)
    db.commit()
    return {"ok": True, "id": invoice_id}


@router.post("/invoices/{invoice_id}/collect")
def collect_invoice(
    entity_id: str,
    invoice_id: str,
    body: InvoiceCollect,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Push an STK or LOOP prompt at the customer to collect what they owe.

    The pending transaction this creates settles from the LOOP callback, and
    that settlement is what marks the invoice paid.
    """
    if _own(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})

    invoice = db.get(models.Invoice, invoice_id)
    if invoice is None or invoice.EntityId != entity_id:
        return JSONResponse(status_code=404, content={"error": "Invoice not found"})
    account = db.get(models.Account, body.account_id)
    if account is None or account.EntityId != entity_id:
        return JSONResponse(status_code=404, content={"error": "Account not found"})

    phone = body.phone or invoice.CustomerPhone
    if not phone:
        return JSONResponse(status_code=400, content={
            "error": "No customer phone on this invoice — add one or pass it in"})

    outstanding = max(0.0, (invoice.Amount or 0) - (invoice.AmountPaid or 0))
    amount = body.amount or outstanding
    if amount <= 0:
        return JSONResponse(status_code=400, content={"error": "Nothing outstanding on this invoice"})

    if body.channel == "loop":
        result = get_gateway().send(LOOP_PROMPT, {
            "mobileNo": phone,
            "amount": f"{amount:.2f}",
            "reason": f"Invoice {invoice.Number}",
            "callBackUrl": loop_callback_url("loop-prompt"),
        })
    else:
        result = get_gateway().send(MPESA_PROMPT, {
            "payMblNo": phone,
            "amount": f"{amount:.2f}",
            "extRefNo": invoice.Number,
            "callBackUrl": loop_callback_url("mpesa-prompt"),
        })

    if not is_success(result):
        return JSONResponse(status_code=502, content={
            "error": "LOOP did not accept the payment request",
            "loop": {"statusCode": result.get("statusCode"), "message": result.get("message")}})

    txn_reference = result["txnReference"]
    tx = track_pending_topup(
        db,
        entity_id=entity_id,
        account_id=account.Id,
        amount=amount,
        txn_reference=txn_reference,
        description=f"Invoice {invoice.Number} — {invoice.CustomerName}",
    )
    tx.Category = "Receivables"
    invoice.LoopTxnReference = txn_reference
    if invoice.Status == "draft":
        invoice.Status = "sent"
    db.commit()
    db.refresh(invoice)
    db.refresh(tx)

    return {
        "ok": True,
        "invoice": invoice_dto(invoice),
        "transaction": transaction_dto(tx),
        "loop": {"txnReference": txn_reference, "message": result.get("message")},
    }


@router.post("/invoices/{invoice_id}/record-payment")
def record_invoice_payment(
    entity_id: str,
    invoice_id: str,
    amount: float,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark part or all of an invoice settled — for cash or off-platform payments."""
    if _own(db, entity_id, user) is None:
        return JSONResponse(status_code=404, content={"error": "Entity not found"})
    invoice = db.get(models.Invoice, invoice_id)
    if invoice is None or invoice.EntityId != entity_id:
        return JSONResponse(status_code=404, content={"error": "Invoice not found"})
    if amount <= 0:
        return JSONResponse(status_code=400, content={"error": "Amount must be greater than zero"})

    invoice.AmountPaid = min(invoice.Amount, (invoice.AmountPaid or 0) + amount)
    invoice.Status = "paid" if invoice.AmountPaid >= invoice.Amount else "part_paid"
    db.commit()
    db.refresh(invoice)
    return invoice_dto(invoice)
