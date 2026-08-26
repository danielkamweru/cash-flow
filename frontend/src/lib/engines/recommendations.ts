import type {
  Goal,
  Recommendation,
  RiskProfile,
  SurplusBreakdown,
  WealthHealthScore,
} from "@/lib/types";

/** Explainable recommendations — never guaranteed returns */
export function buildRecommendations(input: {
  entityId: string;
  surplus: SurplusBreakdown;
  health: WealthHealthScore;
  goals: Goal[];
  risk: RiskProfile;
  equityShare: number;
}): Recommendation[] {
  const recs: Recommendation[] = [];
  const primaryGoal = [...input.goals].sort((a, b) => a.priority - b.priority)[0];

  if (input.surplus.safeToInvest >= 10_000 && primaryGoal) {
    const remaining = Math.max(0, primaryGoal.target - primaryGoal.current);
    recs.push({
      id: `rec-${input.entityId}-goal`,
      entityId: input.entityId,
      title: `Route surplus toward ${primaryGoal.name}`,
      summary: `You currently have ${input.surplus.safeToInvest.toLocaleString("en-KE")} KES available after obligations and your emergency buffer.`,
      why: [
        `Primary goal “${primaryGoal.name}” still needs KES ${remaining.toLocaleString("en-KE")}.`,
        "Emergency reserve logic is already applied before this surplus is shown.",
        `Wealth Health is ${input.health.tier} — prioritising structured progress over idle cash.`,
      ],
      opportunity: `Allocate part of your safe surplus to ${primaryGoal.name} this month.`,
      risk: "low",
      liquidity: "Depends on destination (MMF / SACCO / locked goal pot)",
      timeHorizon: primaryGoal.deadline,
      assumptions: [
        "Balances and obligations in demo data remain accurate.",
        "No unexpected large expense arises before the next payday.",
        "You retain final approval — no money moves automatically.",
      ],
      actionLabel: "Review allocation plan",
      actionState: "demo",
      relatedGoalId: primaryGoal.id,
    });
  }

  if (input.equityShare < 0.15 && input.risk.tolerance !== "low" && input.surplus.safeToInvest >= 5_000) {
    recs.push({
      id: `rec-${input.entityId}-equity`,
      entityId: input.entityId,
      title: "Consider modest NSE exposure (demo opportunity)",
      summary: "Your portfolio has limited equity exposure relative to a growth-oriented profile.",
      why: [
        "Emergency reserve is protected in the surplus calculation.",
        `Risk horizon is ${input.risk.horizon}-term with ${input.risk.tolerance} tolerance.`,
        "Equity share is currently low — diversification may improve long-term growth potential.",
      ],
      opportunity: "Explore demo NSE opportunities that match liquidity and risk filters.",
      risk: "elevated",
      liquidity: "Typically T+2 on NSE (demo)",
      timeHorizon: "3+ years",
      assumptions: [
        "Market data shown is labelled demo/sample — not live prices.",
        "Past or illustrated yields are not guarantees.",
        "You must approve any future connected trade separately.",
      ],
      actionLabel: "Open investment intelligence",
      actionState: "demo",
    });
  }

  if (input.health.factors.find((f) => f.key === "emergency")!.score < 70) {
    recs.push({
      id: `rec-${input.entityId}-buffer`,
      entityId: input.entityId,
      title: "Strengthen emergency buffer first",
      summary: "Before increasing investment risk, close more of your emergency-fund gap.",
      why: [
        "Emergency fund factor is below target in Wealth Health.",
        "A funded buffer reduces forced selling and expensive short-term borrowing.",
        "Safe-to-invest shrinks until the buffer rule is satisfied — by design.",
      ],
      opportunity: "Top up emergency fund with the next safe surplus slice.",
      risk: "low",
      liquidity: "Keep in liquid MMF or cash equivalent",
      timeHorizon: "0–6 months",
      assumptions: ["Target months are based on your risk profile settings."],
      actionLabel: "View emergency goal",
      actionState: "demo",
      relatedGoalId: input.goals.find((g) => g.category === "emergency")?.id,
    });
  }

  return recs;
}
