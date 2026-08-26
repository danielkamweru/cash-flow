import { apiGet, apiPost, authHeaders, API_BASE } from "@/lib/api/client";

export type LoopProduct = {
  id: string;
  name: string;
  status: string;
  description: string;
};

/** The workspace split: personal = payer only; business = merchant workspace. */
export type LoopSide = "PERSONAL" | "BUSINESS";

export const RECEIVE_PRODUCTS = ["mpesa-prompt", "loop-prompt"];
export const MERCHANT_PRODUCTS = ["transaction-inquiry", "transaction-history"];
export const PAY_SEND_PRODUCTS = [
  "pay-to-paybill",
  "pay-to-mpesa-till",
  "pay-to-loop-till",
  "send-money-loop",
  "send-money-mpesa",
  "send-money-pesalink",
];

const PERSONAL_PRODUCTS = new Set(PAY_SEND_PRODUCTS);
const BUSINESS_PRODUCTS = new Set([...RECEIVE_PRODUCTS, ...MERCHANT_PRODUCTS, ...PAY_SEND_PRODUCTS]);

export function productsForSide(products: LoopProduct[], side: LoopSide): LoopProduct[] {
  const allowed = side === "PERSONAL" ? PERSONAL_PRODUCTS : BUSINESS_PRODUCTS;
  return products.filter((p) => p.id !== "authorisation" && allowed.has(p.id));
}

export type LoopFormField = {
  key: string;
  label: string;
  defaultValue: string;
};

export type LoopHistoryEntry = {
  id: string;
  productId: string;
  at: string;
  mode: "live" | "simulated";
  summary: string;
  request?: unknown;
  response?: unknown;
  success: boolean;
  error?: string;
};

export type LoopProductDetail = LoopProduct & {
  fields: LoopFormField[];
  history: LoopHistoryEntry[];
  simulateLabel: string;
};

export type LoopStatus = {
  configured: boolean;
  tillReady?: boolean;
  gateway: string;
  tokenUrl: string;
  merchantTill: string;
  callbackBaseUrl: string;
  docs: string;
  myApps: string;
  products: LoopProduct[];
  note: string;
};

export type LoopSimulateResult = {
  success: boolean;
  mode?: "live" | "simulated";
  message?: string;
  result?: unknown;
  entry?: LoopHistoryEntry;
  history?: LoopHistoryEntry[];
};

export async function fetchLoopStatus() {
  const res = await apiGet<{ success: boolean; data: LoopStatus }>("/loop/status");
  return res.data;
}

export async function fetchLoopProduct(id: string) {
  const res = await apiGet<{ success: boolean; data: LoopProductDetail }>(`/loop/products/${id}`);
  return res.data;
}

export async function fetchLoopProductHistory(id: string) {
  const res = await apiGet<{ success: boolean; data: LoopHistoryEntry[] }>(
    `/loop/products/${id}/history`,
  );
  return res.data;
}

/** Products whose live run requires the account's 4-digit transaction PIN. */
export const PIN_PROTECTED_PRODUCTS = ["send-money-mpesa", "send-money-pesalink"];

export function requiresPin(productId: string, live: boolean): boolean {
  return live && PIN_PROTECTED_PRODUCTS.includes(productId);
}

export async function simulateLoopProduct(
  id: string,
  body: Record<string, unknown>,
  live = false,
) {
  const res = await fetch(`${API_BASE}/loop/products/${id}/simulate`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ...body, live }),
  });
  const json = (await res.json().catch(() => ({}))) as LoopSimulateResult & {
    detail?: { error?: string };
  };
  if (!res.ok && json.success === false) {
    return json;
  }
  if (!res.ok) {
    throw new Error(json.detail?.error || json.message || `Simulate failed (${res.status})`);
  }
  return json;
}

export async function postLoop<T = unknown>(path: string, body?: Record<string, unknown>) {
  return apiPost<T>(`/loop${path}`, body);
}

export type LoopEnvelope<T = unknown> = {
  statusCode: number;
  message: string | null;
  data: T;
  txnReference?: string;
};

type LedgerRefs = { entityId?: string; accountId?: string };

export type LoopPromptRequest = LedgerRefs & {
  mobileNo: string;
  amount: string;
  reason: string;
  callbackUrl?: string;
  till?: string;
};

export type MpesaPromptRequest = LedgerRefs & {
  payMblNo: string;
  amount: string;
  extRefNo: string;
  callbackUrl?: string;
  till?: string;
};

export type PayToTillRequest = LedgerRefs & {
  merchantRcvTill: string;
  accountNumber: string;
  amount: string;
  liabilityId?: string;
  obligationId?: string;
  till?: string;
};

export type SendMoneyRequest = LedgerRefs & {
  recipientMobileNo: string;
  amount: string;
  purposeOfPayment: string;
  goalId?: string;
  automationRuleId?: string;
  /** Required by the backend for the M-Pesa and Pesalink channels. */
  pin?: string;
  till?: string;
};

export const loopPrompt = (req: LoopPromptRequest) => apiPost<LoopEnvelope>("/loop/loop-prompt", req);
export const mpesaPrompt = (req: MpesaPromptRequest) => apiPost<LoopEnvelope>("/loop/mpesa-prompt", req);
export const transactionInquiry = (req: { txnReference: string; till?: string }) =>
  apiPost<LoopEnvelope>("/loop/transactions/inquiry", req);
export const transactionHistory = (req: { limit: number; till?: string }) =>
  apiPost<LoopEnvelope>("/loop/transactions/history", req);
export const payToLoopTill = (req: PayToTillRequest) => apiPost<LoopEnvelope>("/loop/pay/loop-till", req);
export const payToMpesaTill = (req: PayToTillRequest) => apiPost<LoopEnvelope>("/loop/pay/mpesa-till", req);
export const payToPaybill = (req: PayToTillRequest) => apiPost<LoopEnvelope>("/loop/pay/paybill", req);
export const sendMoneyLoop = (req: SendMoneyRequest) => apiPost<LoopEnvelope>("/loop/send-money/loop", req);
export const sendMoneyMpesa = (req: SendMoneyRequest) => apiPost<LoopEnvelope>("/loop/send-money/mpesa", req);
export const sendMoneyPesalink = (req: SendMoneyRequest) =>
  apiPost<LoopEnvelope>("/loop/send-money/pesalink", req);

export async function getLoopHistory(limit = 10) {
  return apiGet<{ success: boolean; body: unknown; path: string }>(
    `/loop/transaction-history?limit=${limit}`,
  );
}
