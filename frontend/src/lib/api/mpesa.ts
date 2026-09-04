import { apiGet, apiPost } from "@/lib/api/client";

export type MpesaStatus = {
  provider: string;
  environment: string;
  paymentMethod: string;
  configured: boolean;
  shortcode: string | null;
  callbackConfigured: boolean;
  portalUrl: string;
  stkPushUrl: string;
  note: string;
};

export type STKPushRequest = {
  phoneNumber: string;
  amount: number;
  accountReference?: string;
  transactionDescription?: string;
  entityId?: string;
  accountId?: string;
};

export type STKPushResponse = {
  success: boolean;
  message: string;
  checkoutRequestId: string | null;
  merchantRequestId: string | null;
};

export type PaymentRecord = {
  checkoutRequestId: string;
  status: "pending" | "completed" | "failed";
  amount: number;
  description: string;
  date: string;
};

export type QRGenerateResponse = {
  success: boolean;
  message: string;
  qrCode: string | null;
  requestId: string | null;
  darajaError?: string;
};

export async function generateMpesaQR(body: {
  amount: number;
  reference: string;
  merchantName?: string;
  trxCode?: "BG" | "PA" | "SM" | "SB";
  entityId?: string;
  accountId?: string;
}): Promise<QRGenerateResponse> {
  return apiPost<QRGenerateResponse>("/mpesa/qr", {
    amount: body.amount,
    reference: body.reference,
    merchant_name: body.merchantName,
    trx_code: body.trxCode ?? "BG",
    entity_id: body.entityId,
    account_id: body.accountId,
  });
}

export async function fetchMpesaStatus(): Promise<MpesaStatus> {
  const res = await apiGet<{ success: boolean; data: MpesaStatus }>("/mpesa/status");
  return res.data;
}

export async function initiateStkPush(body: STKPushRequest): Promise<STKPushResponse> {
  return apiPost<STKPushResponse>("/mpesa/stk-push", {
    phone_number: body.phoneNumber,
    amount: body.amount,
    account_reference: body.accountReference ?? "CASHFLOW",
    transaction_description: body.transactionDescription ?? "Cash-Flow payment",
    entity_id: body.entityId,
    account_id: body.accountId,
  });
}

export async function fetchPayment(checkoutRequestId: string): Promise<PaymentRecord> {
  const res = await apiGet<{ success: boolean; data: PaymentRecord }>(
    `/mpesa/payments/${encodeURIComponent(checkoutRequestId)}`,
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// B2B — Business Buy Goods
// ---------------------------------------------------------------------------

export type B2BPaymentResponse = {
  success: boolean;
  message: string;
  originator_conversation_id: string | null;
  conversation_id: string | null;
  response_code: string | null;
  response_description: string | null;
  reference: string | null;
};

export type B2BPaymentRecord = {
  originatorConversationId: string;
  status: "submitted" | "completed" | "failed" | "timeout" | "pending";
  amount: number;
  description: string;
  date: string;
  partyA: string | null;
  partyB: string | null;
  accountReference: string | null;
  resultCode: string | null;
  resultDesc: string | null;
  transactionId: string | null;
};

export async function initiateB2BPayment(body: {
  amount: number;
  accountReference: string;
  partyB?: string;
  requester?: string;
  remarks?: string;
  entityId?: string;
  accountId?: string;
}): Promise<B2BPaymentResponse> {
  return apiPost<B2BPaymentResponse>("/mpesa/b2b", {
    amount: body.amount,
    account_reference: body.accountReference,
    party_b: body.partyB,
    requester: body.requester,
    remarks: body.remarks ?? "Cash-Flow B2B",
    entity_id: body.entityId,
    account_id: body.accountId,
  });
}

export async function fetchB2BPayment(
  originatorConversationId: string,
): Promise<B2BPaymentRecord> {
  const res = await apiGet<{ success: boolean; data: B2BPaymentRecord }>(
    `/mpesa/b2b/payments/${encodeURIComponent(originatorConversationId)}`,
  );
  return res.data;
}
