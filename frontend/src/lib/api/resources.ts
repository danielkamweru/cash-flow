import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type {
  Asset,
  FinancialAccount,
  Goal,
  Investment,
  Liability,
  Obligation,
  Transaction,
} from "@/lib/types";

const base = (entityId: string) => `/entities/${entityId}`;

/** One CRUD surface per collection — the shapes mirror the backend bodies. */
function collection<T, TCreate, TPatch>(name: string) {
  return {
    list: (entityId: string) => apiGet<T[]>(`${base(entityId)}/${name}`),
    create: (entityId: string, body: TCreate) => apiPost<T>(`${base(entityId)}/${name}`, body),
    update: (entityId: string, id: string, body: TPatch) =>
      apiPatch<T>(`${base(entityId)}/${name}/${id}`, body),
    remove: (entityId: string, id: string) =>
      apiDelete<{ ok: boolean; id: string }>(`${base(entityId)}/${name}/${id}`),
  };
}

export type AccountInput = {
  name: string;
  provider: string;
  institution: string;
  balance: number;
  connectionStatus?: string;
  accountMask?: string | null;
  isLiquid?: boolean;
  isEmergencyReserve?: boolean;
  channel?: string | null;
};

export type AssetInput = { name: string; category: string; value: number; liquidity?: string };

export type InvestmentInput = {
  name: string;
  type: string;
  value: number;
  costBasis?: number | null;
  liquidity?: string;
  risk?: string;
  notes?: string | null;
};

export type LiabilityInput = {
  name: string;
  lender: string;
  balance: number;
  monthlyPayment?: number;
  interestRate?: number | null;
  dueDay?: number | null;
};

export type GoalInput = {
  name: string;
  category?: string;
  target: number;
  current?: number;
  deadline: string;
  monthlyContribution?: number;
  priority?: number;
};

export type ObligationInput = {
  name: string;
  amount: number;
  dueDate: string;
  category?: string;
  status?: string;
};

export type TransactionInput = {
  accountId: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  type?: string;
  applyToBalance?: boolean;
};

export const accountsApi = collection<FinancialAccount, AccountInput, Partial<AccountInput>>("accounts");
export const assetsApi = collection<Asset, AssetInput, Partial<AssetInput>>("assets");
export const investmentsApi = collection<Investment, InvestmentInput, Partial<InvestmentInput>>("investments");
export const liabilitiesApi = collection<Liability, LiabilityInput, Partial<LiabilityInput>>("liabilities");
export const goalsApi = collection<Goal, GoalInput, Partial<GoalInput>>("goals");
export const obligationsApi = collection<Obligation, ObligationInput, Partial<ObligationInput>>("obligations");
export const transactionsApi = collection<Transaction, TransactionInput, Partial<TransactionInput>>("transactions");

/** Wipe every financial record on an entity, keeping the entity itself. */
export function clearBooks(entityId: string) {
  return apiDelete<{ ok: boolean; removed: Record<string, number> }>(`${base(entityId)}/books`);
}

// ---------------------------------------------------------------------------
// Acting on advisor recommendations
// ---------------------------------------------------------------------------

type PaymentLeg = { channel?: string; destination?: string; accountNumber?: string; pin?: string };

export type InvestResult = {
  ok: boolean;
  investment: Investment;
  transaction: Transaction;
  accountBalance: number;
};

export function invest(
  entityId: string,
  body: {
    accountId: string;
    amount: number;
    instrument: string;
    investmentId?: string;
    name?: string;
  } & PaymentLeg,
) {
  return apiPost<InvestResult>(`${base(entityId)}/actions/invest`, body);
}

export function fundGoal(
  entityId: string,
  body: { accountId: string; goalId: string; amount: number } & PaymentLeg,
) {
  return apiPost<{ ok: boolean; goal: Goal; transaction: Transaction; accountBalance: number }>(
    `${base(entityId)}/actions/fund-goal`,
    body,
  );
}

export function payDebt(
  entityId: string,
  body: { accountId: string; liabilityId: string; amount: number } & PaymentLeg,
) {
  return apiPost<{ ok: boolean; liability: Liability; transaction: Transaction; accountBalance: number }>(
    `${base(entityId)}/actions/pay-debt`,
    body,
  );
}
