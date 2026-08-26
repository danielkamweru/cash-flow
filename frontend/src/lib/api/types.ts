import type {
  ActivityEvent,
  Asset,
  AutomationRule,
  BnplAgreement,
  BusinessProfileDetails,
  CreditReadiness,
  Entity,
  FinancialAccount,
  Goal,
  Investment,
  Liability,
  MarketInstrument,
  Obligation,
  ProfileMember,
  Recommendation,
  RiskProfile,
  RuleRun,
  Supplier,
  SurplusBreakdown,
  Transaction,
  WealthHealthScore,
} from "@/lib/types";

/** Snapshot shape returned by ASP.NET `GET /api/entities/.../snapshot` */
export type EntitySnapshot = {
  entity: Entity & { userId?: string };
  netWorth: number;
  liquid: number;
  investments: number;
  assets: number;
  liabilities: number;
  surplus: SurplusBreakdown;
  health: WealthHealthScore;
  recommendations: Recommendation[];
  accounts: FinancialAccount[];
  transactions: Transaction[];
  assetsList: Asset[];
  investmentsList: Investment[];
  liabilitiesList: Liability[];
  obligations: Obligation[];
  goals: Goal[];
  cashflow: { month: string; inflow: number; outflow: number }[];
  credit: CreditReadiness | null;
  automation: AutomationRule[];
  ruleRuns: RuleRun[];
  activity: ActivityEvent[];
  risk: RiskProfile | null;
  markets: MarketInstrument[];
  suppliers: Supplier[];
  bnpl: BnplAgreement[];
  members: ProfileMember[];
  businessDetails: BusinessProfileDetails | null;
  consolidatedNetWorth: number;
  asOf: string;
};

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  hasPin?: boolean;
  createdAt?: string;
  updatedAt?: string;
  entities: Entity[];
};

export type ApiProvider = {
  id: string;
  name: string;
  category: string;
  status: string;
  description: string;
  capabilities: string[];
};
