import type { Obligation, SurplusBreakdown } from "@/lib/types";

/**
 * Safe Surplus Engine
 *
 * Safe Surplus = MAX(0, Liquid Balance − Upcoming Obligations − Emergency Buffer)
 *
 * Safe-to-spend keeps a discretionary slice of surplus for near-term flexibility.
 * Safe-to-invest is the remainder after that discretionary slice.
 */
export function calculateSurplus(input: {
  entityId: string;
  liquidBalance: number;
  obligations: Obligation[];
  emergencyBuffer: number;
  discretionarySpendRatio?: number;
  now?: string;
}): SurplusBreakdown {
  const upcomingObligations = input.obligations
    .filter((o) => o.status === "upcoming" || o.status === "overdue")
    .reduce((sum, o) => sum + o.amount, 0);

  const raw = input.liquidBalance - upcomingObligations - input.emergencyBuffer;
  const safeSurplus = Math.max(0, raw);
  const ratio = input.discretionarySpendRatio ?? 0.35;
  const safeToSpend = Math.round(safeSurplus * ratio);
  const safeToInvest = Math.max(0, safeSurplus - safeToSpend);

  return {
    entityId: input.entityId,
    liquidBalance: input.liquidBalance,
    upcomingObligations,
    emergencyBuffer: input.emergencyBuffer,
    safeToSpend,
    safeToInvest,
    lastCalculated: input.now ?? new Date().toISOString(),
    formula: "MAX(0, Liquid − Obligations − Emergency Buffer)",
    components: [
      { label: "Liquid money", amount: input.liquidBalance, sign: "+" },
      { label: "Upcoming obligations", amount: upcomingObligations, sign: "-" },
      { label: "Emergency buffer", amount: input.emergencyBuffer, sign: "-" },
    ],
  };
}
