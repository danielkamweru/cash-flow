/** Core domain types — designed for Personal / Business / Chama entities */

export type EntityType = "PERSONAL" | "BUSINESS" | "CHAMA";

export type AccountProvider =
  | "mpesa"
  | "bank"
  | "sacco"
  | "mmf"
  | "nse"
  | "treasury"
  | "cash"
  | "manual"
  | "other";

export type ConnectionStatus =
  | "connected"
  | "demo"
  | "manual"
  | "pending"
  | "disconnected"
  | "coming_soon";

export type DataProvenance = "actual" | "estimated" | "demo" | "user_entered";

export type GoalCategory =
  | "emergency"
  | "education"
  | "purchase"
  | "business"
  | "property"
  | "retirement"
  | "investment"
  | "other";

export type WealthHealthTier =
  | "FOUNDATION"
  | "BUILDER"
  | "GROWING"
  | "STRONG"
  | "ADVANCED";

export type RiskLevel = "low" | "moderate" | "elevated" | "high";

export type MarketInstrumentType = "mmf" | "nse" | "tbill" | "tbond" | "infra_bond";

export interface Money {
  amount: number;
  currency: "KES";
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
}

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  description?: string;
}

export interface FinancialAccount {
  id: string;
  entityId: string;
  name: string;
  provider: AccountProvider;
  institution: string;
  balance: number;
  currency: "KES";
  connectionStatus: ConnectionStatus;
  provenance: DataProvenance;
  lastUpdated: string;
  accountMask?: string;
  /** Liquid balances are what safe-to-spend is calculated from. */
  isLiquid?: boolean;
  isEmergencyReserve?: boolean;
  channel?: string | null;
}

export interface Transaction {
  id: string;
  entityId: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: "inflow" | "outflow" | "transfer" | "fee";
  provenance: DataProvenance;
  /** Pending until LOOP confirms via callback or status inquiry. */
  status?: TransactionStatus;
  loopTxnReference?: string | null;
}

export type TransactionStatus = "pending" | "completed" | "failed";

export interface Asset {
  id: string;
  entityId: string;
  name: string;
  category: string;
  value: number;
  liquidity: "liquid" | "semi_liquid" | "illiquid";
  provenance: DataProvenance;
  lastUpdated: string;
}

export interface Investment {
  id: string;
  entityId: string;
  name: string;
  type: MarketInstrumentType | "sacco" | "other";
  value: number;
  costBasis?: number;
  liquidity: "daily" | "tplus2" | "locked" | "maturity";
  risk: RiskLevel;
  provenance: DataProvenance;
  notes?: string;
  lastUpdated: string;
}

export interface Liability {
  id: string;
  entityId: string;
  name: string;
  lender: string;
  balance: number;
  monthlyPayment: number;
  interestRate?: number;
  dueDay?: number;
  provenance: DataProvenance;
  lastUpdated: string;
}

export interface Obligation {
  id: string;
  entityId: string;
  name: string;
  amount: number;
  dueDate: string;
  category: string;
  status: "upcoming" | "paid" | "overdue";
}

export interface Goal {
  id: string;
  entityId: string;
  name: string;
  category: GoalCategory;
  target: number;
  current: number;
  deadline: string;
  monthlyContribution: number;
  priority: number;
}

export interface RiskProfile {
  entityId: string;
  horizon: "short" | "medium" | "long";
  tolerance: RiskLevel;
  emergencyFundMonthsTarget: number;
  notes?: string;
}

export interface WealthHealthScore {
  entityId: string;
  tier: WealthHealthTier;
  score: number; // 0–100
  factors: {
    key: string;
    label: string;
    score: number;
    weight: number;
    note: string;
  }[];
  lastCalculated: string;
  disclaimer: string;
}

export interface SurplusBreakdown {
  entityId: string;
  liquidBalance: number;
  upcomingObligations: number;
  emergencyBuffer: number;
  safeToSpend: number;
  safeToInvest: number;
  lastCalculated: string;
  formula: string;
  components: { label: string; amount: number; sign: "+" | "-" }[];
}

export interface Recommendation {
  id: string;
  entityId: string;
  title: string;
  summary: string;
  why: string[];
  opportunity?: string;
  risk: RiskLevel;
  liquidity: string;
  timeHorizon: string;
  assumptions: string[];
  actionLabel: string;
  actionState: "demo" | "coming_soon" | "requires_connection" | "ready";
  relatedGoalId?: string;
}

export interface MarketInstrument {
  id: string;
  type: MarketInstrumentType;
  name: string;
  provider: string;
  yieldLabel: string;
  yieldValue: string;
  risk: RiskLevel;
  liquidity: string;
  minInvestment: number;
  dataStatus: "demo" | "sample" | "simulated" | "unavailable";
  asOf?: string;
  notes?: string;
}

export interface AutomationRule {
  id: string;
  entityId: string;
  name: string;
  description: string;
  status:
    | "draft"
    | "awaiting_authorization"
    | "coming_soon"
    | "active_demo"
    | "declined"
    | "paused";
  trigger: string;
  action: string;
  targetGoalId?: string | null;
  triggerSpec?: {
    kind: string;
    threshold?: number | null;
    amountMin?: number | null;
    windowDays?: number | null;
    target?: string | null;
  } | null;
  actionSpec?: {
    op: string;
    amountRule?: string | null;
    amount?: number | null;
    targetGoalId?: string | null;
    recipientMobileNo?: string | null;
    purpose?: string | null;
  } | null;
  autoApprove: boolean;
  authorizedAt?: string | null;
  executedAt?: string | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
}

export type RuleRunOutcome =
  | "proposed"
  | "approved"
  | "declined"
  | "executed"
  | "failed"
  | "skipped"
  | "guarded";

export interface RuleRun {
  id: string;
  ruleId: string;
  entityId: string;
  triggeredAt: string;
  outcome: RuleRunOutcome;
  runMode: "dry_run" | "simulated" | "live";
  proposedAmount?: number | null;
  txnReference?: string | null;
  error?: string | null;
  detail?: string | null;
}

export interface Supplier {
  id: string;
  entityId: string;
  name: string;
  trustScore: number;
  paybillOrTill?: string | null;
  paymentHistory: { onTimePayments?: number; latePayments?: number; averageDays?: number };
  agreements: BnplAgreement[];
}

export interface BnplAgreement {
  id: string;
  supplierId: string;
  principal: number;
  balance: number;
  status: string;
  installments: { dueDate: string; amount: number; status: string }[];
}

export interface ProfileMember {
  id: string;
  entityId: string;
  userId: string;
  role: string;
  joinedAt: string;
  name?: string | null;
}

export interface BusinessProfileDetails {
  entityId: string;
  registrationNumber?: string | null;
  kraPin?: string | null;
  businessType?: string | null;
  registeredAt?: string | null;
}

export interface ActivityEvent {
  id: string;
  entityId: string;
  timestamp: string;
  title: string;
  detail: string;
  kind: "analysis" | "goal" | "connection" | "recommendation" | "system";
}

export interface CreditReadiness {
  entityId: string;
  level: "BUILDING" | "FAIR" | "GOOD" | "STRONG";
  incomeMonthly: number;
  expensesMonthly: number;
  monthlySurplus: number;
  liquidAssets: number;
  investments: number;
  liabilities: number;
  debtBurdenRatio: number;
  savingsConsistency: number;
  historyMonths: number;
  notes: string[];
  disclaimer: string;
  lastUpdated: string;
}

export interface ProviderDefinition {
  id: string;
  name: string;
  category: AccountProvider;
  status: ConnectionStatus;
  description: string;
  capabilities: string[];
}

export type TrafficLight = "green" | "amber" | "red";

export interface InvestmentAllocation {
  instrumentId: string;
  type: MarketInstrumentType | string;
  role: string;
  name: string;
  provider: string;
  yieldLabel: string;
  yieldValue: string;
  risk: RiskLevel | string;
  liquidity: string;
  minInvestment: number;
  dataStatus: string;
  weight: number;
  amount: number;
  notes?: string | null;
  recommended: boolean;
}

export interface InvestmentAdvice {
  allowed: boolean;
  title: string;
  plainAdvice: string;
  suggestedAmount: number;
  strategy?: string;
  allocations?: InvestmentAllocation[];
  automationEnabled?: boolean;
  autonomous?: boolean;
  automationStatus?: string;
  dataStatus: string;
}

export interface PersonalAutomationState {
  enabled: boolean;
  mode: "autonomous" | "recommend_only" | string;
  label: string;
  rules?: Array<{
    id: string;
    name: string;
    description?: string;
    status: string;
    trigger?: string;
    action: string;
  }>;
}

export interface PersonalCoachHome {
  entityId: string;
  asOf: string;
  trafficLight: TrafficLight;
  headline: string;
  safeToSpendToday: number;
  safeToInvest: number;
  emergency: {
    current: number;
    target: number;
    monthsCovered: number;
    targetMonths: number;
    intact: boolean;
    plainStatus: string;
  };
  nextBill: {
    id: string;
    name: string;
    amount: number;
    daysUntilDue: number;
    plainWarning: string | null;
    paybillNumber: string | null;
  } | null;
  unpaidBills: Array<{
    id: string;
    name: string;
    amount: number;
    daysUntilDue: number;
    plainWarning: string | null;
    status: string;
  }>;
  envelopes: Array<{
    id: string;
    name: string;
    kind: string;
    monthlyLimit: number;
    spentAmount: number;
    remaining: number;
    utilizationPct: number;
    plainStatus: string;
  }>;
  runway: {
    shortfallDate: string | null;
    daysUntilShortfall: number | null;
    plainShortfallMessage: string | null;
    dailyDiscretionaryBurn: number;
  };
  investmentAdvice: InvestmentAdvice;
  automation?: PersonalAutomationState;
  loopActions: Array<{
    actionId: string;
    loopProduct: string;
    title: string;
    plainReason: string;
    amount: number;
    billId: string | null;
    endpointHint: string | null;
    blockedReason: string | null;
  }>;
  warnings: string[];
}
