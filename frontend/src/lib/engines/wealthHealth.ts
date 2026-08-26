import type {
  Goal,
  Liability,
  SurplusBreakdown,
  Transaction,
  WealthHealthScore,
  WealthHealthTier,
} from "@/lib/types";

function tierFromScore(score: number): WealthHealthTier {
  if (score >= 85) return "ADVANCED";
  if (score >= 70) return "STRONG";
  if (score >= 55) return "GROWING";
  if (score >= 35) return "BUILDER";
  return "FOUNDATION";
}

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Wealth Health — legitimate financial-health indicator (NOT a CRB score).
 */
export function calculateWealthHealth(input: {
  entityId: string;
  surplus: SurplusBreakdown;
  monthlyIncome: number;
  monthlyExpenses: number;
  emergencyFundCurrent: number;
  emergencyFundTarget: number;
  liabilities: Liability[];
  investmentsValue: number;
  totalAssets: number;
  goals: Goal[];
  recentTransactions: Transaction[];
  now?: string;
}): WealthHealthScore {
  const cashFlowStability =
    input.monthlyIncome <= 0
      ? 20
      : clamp(((input.monthlyIncome - input.monthlyExpenses) / input.monthlyIncome) * 100 + 40);

  const liquidity = clamp((input.surplus.liquidBalance / Math.max(input.monthlyExpenses, 1)) * 25);

  const emergencyFund = clamp(
    (input.emergencyFundCurrent / Math.max(input.emergencyFundTarget, 1)) * 100,
  );

  const totalDebt = input.liabilities.reduce((s, l) => s + l.balance, 0);
  const debtService = input.liabilities.reduce((s, l) => s + l.monthlyPayment, 0);
  const debtManagement =
    input.monthlyIncome <= 0
      ? 40
      : clamp(100 - (debtService / input.monthlyIncome) * 180 - (totalDebt / Math.max(input.totalAssets, 1)) * 40);

  const diversification =
    input.totalAssets <= 0
      ? 10
      : clamp((input.investmentsValue / input.totalAssets) * 140);

  const savingsTx = input.recentTransactions.filter(
    (t) => t.type === "outflow" && /save|mmf|invest|sacco|goal/i.test(t.category + t.description),
  ).length;
  const savingsConsistency = clamp(30 + savingsTx * 12);

  const goalProgress =
    input.goals.length === 0
      ? 40
      : clamp(
          (input.goals.reduce((s, g) => s + Math.min(1, g.current / Math.max(g.target, 1)), 0) /
            input.goals.length) *
            100,
        );

  const factors = [
    { key: "cashflow", label: "Cash-flow stability", score: Math.round(cashFlowStability), weight: 0.18, note: "Income vs recurring expenses" },
    { key: "liquidity", label: "Liquidity", score: Math.round(liquidity), weight: 0.14, note: "Liquid cover relative to monthly spend" },
    { key: "emergency", label: "Emergency fund", score: Math.round(emergencyFund), weight: 0.18, note: "Buffer vs your target months" },
    { key: "debt", label: "Debt management", score: Math.round(debtManagement), weight: 0.16, note: "Service burden and leverage" },
    { key: "diversification", label: "Investment diversification", score: Math.round(diversification), weight: 0.12, note: "Share of wealth in productive assets" },
    { key: "savings", label: "Savings consistency", score: Math.round(savingsConsistency), weight: 0.12, note: "Recent saving/investing activity" },
    { key: "goals", label: "Goal progress", score: Math.round(goalProgress), weight: 0.1, note: "Average progress across active goals" },
  ];

  const score = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0));

  return {
    entityId: input.entityId,
    tier: tierFromScore(score),
    score,
    factors,
    lastCalculated: input.now ?? new Date().toISOString(),
    disclaimer:
      "Wealth Loop financial-health indicator. This is not a CRB score, credit bureau report, or loan approval guarantee.",
  };
}
