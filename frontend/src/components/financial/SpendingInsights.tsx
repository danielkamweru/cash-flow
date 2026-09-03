"use client";

import { SensitiveValue } from "@/components/ui/SensitiveValue";
import { formatKes, formatPercent } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Pure analytics — no fabrication, only calculated from real transactions
// ---------------------------------------------------------------------------

type CategorySpend = { category: string; amount: number };

function isoMonth(date: string): string {
  return date.slice(0, 7); // "YYYY-MM"
}

function outflows(txns: Transaction[]): Transaction[] {
  return txns.filter((t) => t.type === "outflow" && (t.status ?? "completed") !== "failed");
}

function inflows(txns: Transaction[]): Transaction[] {
  return txns.filter((t) => t.type === "inflow" && (t.status ?? "completed") !== "failed");
}

function sumBy(txns: Transaction[]): number {
  return txns.reduce((s, t) => s + t.amount, 0);
}

function spendByCategory(txns: Transaction[]): CategorySpend[] {
  const map = new Map<string, number>();
  for (const t of outflows(txns)) {
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function txnsInMonth(txns: Transaction[], yyyyMM: string): Transaction[] {
  return txns.filter((t) => isoMonth(t.date) === yyyyMM);
}

function prevMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const d = new Date(y, m - 2, 1); // month is 0-indexed
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Derived insight types
// ---------------------------------------------------------------------------

type IncomeExpenseSummary = {
  income: number;
  expenses: number;
  surplus: number;
  priorIncome: number;
  priorExpenses: number;
};

type SpendingInsight = {
  topCategory: CategorySpend | null;
  momChange: number | null; // month-over-month % change in total spend (negative = less)
  momAbsolute: number | null;
};

type UnusualCategory = {
  category: string;
  thisMonth: number;
  average: number;
  pctAbove: number;
};

function computeInsights(
  txns: Transaction[],
  currentMonth: string,
): {
  summary: IncomeExpenseSummary;
  insight: SpendingInsight;
  unusual: UnusualCategory[];
} {
  const prior = prevMonth(currentMonth);

  const thisTxns = txnsInMonth(txns, currentMonth);
  const priorTxns = txnsInMonth(txns, prior);

  const income = sumBy(inflows(thisTxns));
  const expenses = sumBy(outflows(thisTxns));
  const priorIncome = sumBy(inflows(priorTxns));
  const priorExpenses = sumBy(outflows(priorTxns));

  // Top category
  const cats = spendByCategory(thisTxns);
  const topCategory = cats[0] ?? null;

  // Month-over-month spend change
  let momChange: number | null = null;
  let momAbsolute: number | null = null;
  if (priorExpenses > 0) {
    momAbsolute = expenses - priorExpenses;
    momChange = (momAbsolute / priorExpenses) * 100;
  }

  // Unusual spending: compare this month's category spend to 3-month average
  // Collect the 3 months before the current month
  const historicMonths: string[] = [];
  let cursor = prior;
  for (let i = 0; i < 3; i++) {
    historicMonths.push(cursor);
    cursor = prevMonth(cursor);
  }

  const historicTxns = txns.filter((t) => historicMonths.includes(isoMonth(t.date)));
  const historicCats = spendByCategory(historicTxns);
  const historicMap = new Map(historicCats.map((c) => [c.category, c.amount / historicMonths.length]));

  const unusual: UnusualCategory[] = [];
  for (const { category, amount } of cats) {
    const avg = historicMap.get(category) ?? 0;
    if (avg < 500) continue; // ignore tiny categories — not meaningful
    const pctAbove = avg > 0 ? ((amount - avg) / avg) * 100 : 0;
    if (pctAbove >= 50 && amount - avg >= 500) {
      unusual.push({ category, thisMonth: amount, average: avg, pctAbove });
    }
  }
  // Sort by most unusual first
  unusual.sort((a, b) => b.pctAbove - a.pctAbove);

  return {
    summary: { income, expenses, surplus: income - expenses, priorIncome, priorExpenses },
    insight: { topCategory, momChange, momAbsolute },
    unusual,
  };
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replaceAll("_", " ");
}

function pctLabel(pct: number): string {
  return `${Math.abs(Math.round(pct))}%`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpendingInsights({ transactions }: { transactions: Transaction[] }) {
  // Always analyse the current calendar month regardless of the dashboard date filter —
  // insights are most useful when anchored to "this month".
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const { summary, insight, unusual } = useMemo(
    () => computeInsights(transactions, currentMonth),
    [transactions, currentMonth],
  );

  // Need at least some outflow data to show anything meaningful
  if (summary.expenses === 0 && summary.income === 0) return null;

  const surplusPositive = summary.surplus >= 0;

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------------ */}
      {/* Task 20 — Income vs expense summary                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="cf-card p-5">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-cf-muted">
          This month · income vs expenses
        </p>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { label: "Income", value: summary.income, tone: "text-cf-success" },
              { label: "Expenses", value: summary.expenses, tone: "text-cf-text" },
              {
                label: "Surplus",
                value: summary.surplus,
                tone: surplusPositive ? "text-cf-success" : "text-cf-danger",
              },
            ] as const
          ).map(({ label, value, tone }) => (
            <div key={label} className="min-w-0 rounded-xl border border-cf-border bg-[var(--cf-inset)] px-3 py-3">
              <p className="text-[10px] uppercase tracking-wide text-cf-muted">{label}</p>
              <p className={`mt-1 break-words font-display text-lg font-semibold tabular-nums ${tone}`}>
                <SensitiveValue value={value} />
              </p>
            </div>
          ))}
        </div>

        {/* Prior-month comparison row */}
        {summary.priorExpenses > 0 && (
          <p className="mt-3 text-xs text-cf-muted">
            Last month:{" "}
            <span className="text-cf-text">
              <SensitiveValue value={summary.priorIncome} />
            </span>{" "}
            in ·{" "}
            <span className="text-cf-text">
              <SensitiveValue value={summary.priorExpenses} />
            </span>{" "}
            out
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Tasks 19 & 21 — Spending insights + unusual spending                */}
      {/* ------------------------------------------------------------------ */}
      {(insight.topCategory || insight.momChange !== null || unusual.length > 0) && (
        <section className="cf-card divide-y divide-cf-border/60 overflow-hidden">
          <p className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-cf-muted">
            Spending insights · this month
          </p>

          {/* Top category */}
          {insight.topCategory && (
            <div className="flex items-start gap-3 px-5 py-4">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cf-primary/10 text-cf-primary">
                <TrendingUp className="h-3.5 w-3.5" />
              </span>
              <p className="text-sm text-cf-text">
                Your largest spending category is{" "}
                <strong>{capitalize(insight.topCategory.category)}</strong> at{" "}
                <strong>
                  <SensitiveValue value={insight.topCategory.amount} />
                </strong>
                {summary.expenses > 0 && (
                  <span className="text-cf-muted">
                    {" "}
                    ({formatPercent((insight.topCategory.amount / summary.expenses) * 100, 0)} of total spend)
                  </span>
                )}
                .
              </p>
            </div>
          )}

          {/* Month-over-month change */}
          {insight.momChange !== null && insight.momAbsolute !== null && (
            <div className="flex items-start gap-3 px-5 py-4">
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  insight.momChange <= 0 ? "bg-cf-success/10 text-cf-success" : "bg-cf-warning/10 text-cf-warning"
                }`}
              >
                {insight.momChange <= 0 ? (
                  <TrendingDown className="h-3.5 w-3.5" />
                ) : (
                  <TrendingUp className="h-3.5 w-3.5" />
                )}
              </span>
              <p className="text-sm text-cf-text">
                You spent{" "}
                <strong className={insight.momChange <= 0 ? "text-cf-success" : "text-cf-warning"}>
                  {pctLabel(insight.momChange)} {insight.momChange <= 0 ? "less" : "more"}
                </strong>{" "}
                this month compared with last month
                <span className="text-cf-muted">
                  {" "}
                  ({insight.momAbsolute > 0 ? "+" : ""}
                  {formatKes(insight.momAbsolute)})
                </span>
                .
              </p>
            </div>
          )}

          {/* Unusual spending alerts */}
          {unusual.slice(0, 3).map((u) => (
            <div key={u.category} className="flex items-start gap-3 px-5 py-4">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cf-warning/10 text-cf-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
              <p className="text-sm text-cf-text">
                Your <strong>{capitalize(u.category)}</strong> spending is{" "}
                <strong className="text-cf-warning">{pctLabel(u.pctAbove)} higher than usual</strong> this month
                <span className="text-cf-muted">
                  {" "}
                  (<SensitiveValue value={u.thisMonth} /> vs{" "}
                  <SensitiveValue value={Math.round(u.average)} /> avg)
                </span>
                .
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
