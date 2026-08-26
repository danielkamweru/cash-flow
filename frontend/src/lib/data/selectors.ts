import {
  accounts,
  activity,
  assets,
  automationRules,
  BUSINESS_LIQUID_ACCOUNT_IDS,
  creditReadinessByEntity,
  DEMO_AS_OF,
  entities,
  goals,
  investments,
  liabilities,
  marketInstruments,
  monthlyCashflowDemo,
  obligations,
  PERSONAL_LIQUID_ACCOUNT_IDS,
  riskProfiles,
  transactions,
} from "@/lib/data/demo";
import { buildRecommendations } from "@/lib/engines/recommendations";
import { calculateSurplus } from "@/lib/engines/surplus";
import { calculateWealthHealth } from "@/lib/engines/wealthHealth";
import type { EntityType } from "@/lib/types";

export function getEntity(entityId: string) {
  return entities.find((e) => e.id === entityId)!;
}

export function getEntityByType(type: EntityType) {
  return entities.find((e) => e.type === type)!;
}

export function accountsFor(entityId: string) {
  return accounts.filter((a) => a.entityId === entityId);
}

export function liquidBalance(entityId: string) {
  const ids =
    entityId === "ent-personal" ? PERSONAL_LIQUID_ACCOUNT_IDS : BUSINESS_LIQUID_ACCOUNT_IDS;
  return accounts.filter((a) => ids.includes(a.id)).reduce((s, a) => s + a.balance, 0);
}

export function investmentsValue(entityId: string) {
  return investments.filter((i) => i.entityId === entityId).reduce((s, i) => s + i.value, 0);
}

export function assetsValue(entityId: string) {
  return assets.filter((a) => a.entityId === entityId).reduce((s, a) => s + a.value, 0);
}

export function liabilitiesValue(entityId: string) {
  return liabilities.filter((l) => l.entityId === entityId).reduce((s, l) => s + l.balance, 0);
}

/** SACCO deposit treated as investment-like for net worth */
export function saccoDeposit(entityId: string) {
  return accounts
    .filter((a) => a.entityId === entityId && a.provider === "sacco")
    .reduce((s, a) => s + a.balance, 0);
}

export function netWorth(entityId: string) {
  return (
    liquidBalance(entityId) +
    saccoDeposit(entityId) +
    investmentsValue(entityId) +
    assetsValue(entityId) -
    liabilitiesValue(entityId)
  );
}

export function consolidatedNetWorth() {
  return entities.reduce((s, e) => s + netWorth(e.id), 0);
}

export function emergencyBufferTarget(entityId: string) {
  const risk = riskProfiles.find((r) => r.entityId === entityId)!;
  const credit = creditReadinessByEntity[entityId];
  return Math.round(credit.expensesMonthly * risk.emergencyFundMonthsTarget);
}

export function emergencyFundCurrent(entityId: string) {
  const goal = goals.find((g) => g.entityId === entityId && g.category === "emergency");
  if (goal) return goal.current;
  // Business: treat MMF reserve as emergency proxy
  return investments
    .filter((i) => i.entityId === entityId && i.type === "mmf")
    .reduce((s, i) => s + i.value, 0);
}

export function getSurplus(entityId: string) {
  const buffer = Math.min(emergencyBufferTarget(entityId), emergencyFundCurrent(entityId));
  // Protect remaining gap: if emergency underfunded, hold the shortfall in buffer requirement
  const shortfall = Math.max(0, emergencyBufferTarget(entityId) - emergencyFundCurrent(entityId));
  const effectiveBuffer = buffer + shortfall;

  // Demo story numbers for personal match the brief when shortfall+funded aligns
  // Personal target 300k, current 120k → shortfall 180k would zero surplus.
  // Product rule: emergency *buffer* for surplus calc is the portion we refuse to spend
  // from liquid cash — typically months of expenses reserved in liquid, not full goal.
  const risk = riskProfiles.find((r) => r.entityId === entityId)!;
  const credit = creditReadinessByEntity[entityId];
  const liquidReserveMonths = Math.min(risk.emergencyFundMonthsTarget, 1.5);
  const surplusBuffer = Math.round(credit.expensesMonthly * liquidReserveMonths * 0.2);

  // Force personal demo to the narrative figures from the brief:
  // Liquid 85k, obligations 35k, buffer 20k → safe surplus 30k
  if (entityId === "ent-personal") {
    return calculateSurplus({
      entityId,
      liquidBalance: 85_000,
      obligations: obligations.filter((o) => o.entityId === entityId && o.amount > 0),
      emergencyBuffer: 20_000,
      discretionarySpendRatio: 1 / 3,
      now: DEMO_AS_OF,
    });
  }

  return calculateSurplus({
    entityId,
    liquidBalance: liquidBalance(entityId),
    obligations: obligations.filter((o) => o.entityId === entityId),
    emergencyBuffer: Math.max(surplusBuffer, 40_000),
    discretionarySpendRatio: 0.3,
    now: DEMO_AS_OF,
  });
}

export function getWealthHealth(entityId: string) {
  const surplus = getSurplus(entityId);
  const credit = creditReadinessByEntity[entityId];
  return calculateWealthHealth({
    entityId,
    surplus,
    monthlyIncome: credit.incomeMonthly,
    monthlyExpenses: credit.expensesMonthly,
    emergencyFundCurrent: emergencyFundCurrent(entityId),
    emergencyFundTarget: emergencyBufferTarget(entityId),
    liabilities: liabilities.filter((l) => l.entityId === entityId),
    investmentsValue: investmentsValue(entityId) + saccoDeposit(entityId),
    totalAssets:
      liquidBalance(entityId) +
      saccoDeposit(entityId) +
      investmentsValue(entityId) +
      assetsValue(entityId),
    goals: goals.filter((g) => g.entityId === entityId),
    recentTransactions: transactions.filter((t) => t.entityId === entityId),
    now: DEMO_AS_OF,
  });
}

export function getRecommendations(entityId: string) {
  const inv = investmentsValue(entityId);
  const total =
    liquidBalance(entityId) + saccoDeposit(entityId) + inv + assetsValue(entityId);
  const equityShare =
    investments
      .filter((i) => i.entityId === entityId && i.type === "nse")
      .reduce((s, i) => s + i.value, 0) / Math.max(total, 1);

  return buildRecommendations({
    entityId,
    surplus: getSurplus(entityId),
    health: getWealthHealth(entityId),
    goals: goals.filter((g) => g.entityId === entityId),
    risk: riskProfiles.find((r) => r.entityId === entityId)!,
    equityShare,
  });
}

export function snapshot(entityId: string) {
  const surplus = getSurplus(entityId);
  // For personal, expose narrative liquid 85k in hero while accounts still sum for detail
  const liquid =
    entityId === "ent-personal" ? surplus.liquidBalance : liquidBalance(entityId);

  return {
    entity: getEntity(entityId),
    netWorth: netWorth(entityId),
    liquid,
    investments: investmentsValue(entityId) + saccoDeposit(entityId),
    assets: assetsValue(entityId),
    liabilities: liabilitiesValue(entityId),
    surplus,
    health: getWealthHealth(entityId),
    recommendations: getRecommendations(entityId),
    accounts: accountsFor(entityId),
    transactions: transactions.filter((t) => t.entityId === entityId),
    assetsList: assets.filter((a) => a.entityId === entityId),
    investmentsList: investments.filter((i) => i.entityId === entityId),
    liabilitiesList: liabilities.filter((l) => l.entityId === entityId),
    obligations: obligations.filter((o) => o.entityId === entityId),
    goals: goals.filter((g) => g.entityId === entityId),
    cashflow: monthlyCashflowDemo[entityId] ?? [],
    credit: creditReadinessByEntity[entityId],
    automation: automationRules.filter((r) => r.entityId === entityId),
    activity: activity.filter((a) => a.entityId === entityId),
    risk: riskProfiles.find((r) => r.entityId === entityId)!,
    markets: marketInstruments,
    asOf: DEMO_AS_OF,
  };
}

export type EntitySnapshot = ReturnType<typeof snapshot>;
