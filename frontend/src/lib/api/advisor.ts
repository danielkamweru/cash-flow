import { apiGet } from "@/lib/api/client";

export type AdvisorSeverity = "critical" | "high" | "medium" | "low" | "info";

export type AdvisorFinding = {
  agent: string;
  severity: AdvisorSeverity;
  title: string;
  detail: string;
  evidence: string[];
  metrics: Record<string, unknown>;
};

export type AdvisorAction = {
  title: string;
  rationale: string;
  amount: number | null;
  cadence: string | null;
  instrument: string | null;
  instrumentLabel: string | null;
  liquidity: string | null;
  risk: string | null;
  priority: number;
  assumptions: string[];
};

export type AdvisorReport = {
  entityId: string;
  generatedAt: string;
  headline: string;
  summary: string;
  findings: AdvisorFinding[];
  actions: AdvisorAction[];
  metrics: {
    monthlyIncome: number;
    monthlyExpenses: number;
    monthlySurplus: number;
    liquid: number;
    emergencyCover: number;
    emergencyTarget: number;
    monthsAnalysed: number;
    transactionsAnalysed: number;
  };
  agents: string[];
  disclaimer: string;
};

export function fetchAdvice(entityId: string, months = 6) {
  return apiGet<AdvisorReport>(`/entities/${entityId}/advisor?months=${months}`);
}
