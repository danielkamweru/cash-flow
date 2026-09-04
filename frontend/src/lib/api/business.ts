import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type { BnplAgreement, Supplier, Transaction } from "@/lib/types";

const base = (entityId: string) => `/entities/${entityId}/business`;

export type Invoice = {
  id: string;
  entityId: string;
  number: string;
  customerName: string;
  customerPhone: string | null;
  amount: number;
  amountPaid: number;
  outstanding: number;
  issuedAt: string | null;
  dueDate: string | null;
  status: "draft" | "sent" | "part_paid" | "paid" | "overdue" | "cancelled";
  daysOverdue: number;
  notes: string | null;
  lineItems: { desc?: string; qty?: number; price?: number }[];
  paymentReference: string | null;
};

export type Ageing = {
  entityId: string;
  buckets: { current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number };
  totalOutstanding: number;
  invoiceCount: number;
};

// ---- suppliers -------------------------------------------------------------

export const listSuppliers = (entityId: string) =>
  apiGet<(Supplier & { agreements: BnplAgreement[] })[]>(`${base(entityId)}/suppliers`);

export const createSupplier = (
  entityId: string,
  body: { name: string; paybillOrTill?: string | null; trustScore?: number },
) => apiPost<Supplier>(`${base(entityId)}/suppliers`, body);

export const updateSupplier = (
  entityId: string,
  id: string,
  body: { name?: string; paybillOrTill?: string | null; trustScore?: number },
) => apiPatch<Supplier>(`${base(entityId)}/suppliers/${id}`, body);

export const deleteSupplier = (entityId: string, id: string) =>
  apiDelete<{ ok: boolean }>(`${base(entityId)}/suppliers/${id}`);

/** Settles a supplier from an account. */
export const paySupplier = (
  entityId: string,
  id: string,
  body: {
    accountId: string;
    amount: number;
    channel?: "paybill" | "mpesa-till";
    accountNumber?: string;
    bnplAgreementId?: string;
  },
) =>
  apiPost<{
    ok: boolean;
    supplier: Supplier;
    transaction: Transaction;
    accountBalance: number;
  }>(`${base(entityId)}/suppliers/${id}/pay`, body);

// ---- invoices --------------------------------------------------------------

export const listInvoices = (entityId: string) => apiGet<Invoice[]>(`${base(entityId)}/invoices`);

export const createInvoice = (
  entityId: string,
  body: {
    customerName: string;
    customerPhone?: string | null;
    amount: number;
    dueDate?: string;
    notes?: string | null;
    number?: string;
  },
) => apiPost<Invoice>(`${base(entityId)}/invoices`, body);

export const updateInvoice = (entityId: string, id: string, body: Partial<Invoice>) =>
  apiPatch<Invoice>(`${base(entityId)}/invoices/${id}`, body);

export const deleteInvoice = (entityId: string, id: string) =>
  apiDelete<{ ok: boolean }>(`${base(entityId)}/invoices/${id}`);

/** Pushes an M-Pesa STK prompt at the customer to collect what they owe. */
export const collectInvoice = (
  entityId: string,
  id: string,
  body: { accountId: string; channel?: "mpesa"; amount?: number; phone?: string },
) =>
  apiPost<{
    ok: boolean;
    invoice: Invoice;
    transaction: Transaction;
    payment: { checkoutRequestId: string; message: string | null };
  }>(`${base(entityId)}/invoices/${id}/collect`, body);

/** Marks part or all of an invoice settled — for cash or off-platform payments. */
export const recordInvoicePayment = (entityId: string, id: string, amount: number) =>
  apiPost<Invoice>(`${base(entityId)}/invoices/${id}/record-payment?amount=${encodeURIComponent(amount)}`);

export const fetchAgeing = (entityId: string) =>
  apiGet<Ageing>(`${base(entityId)}/receivables/ageing`);
