"use client";

import { MetricCard, PageHeader } from "@/components/ui/primitives";
import { useEntityData } from "@/lib/context/EntityContext";
import { formatKes, formatPercent, formatRelative } from "@/lib/format";

export default function CreditReadinessPage() {
  const data = useEntityData();
  const c = data.credit;

  if (!c) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Credit readiness"
          subtitle="Financial readiness for your planning — not a loan promise or CRB score."
        />
        <p className="text-sm text-wl-muted">No credit readiness record for this entity yet.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Credit readiness"
        subtitle="Financial readiness for your planning — not a loan promise or CRB score."
      />
      <div className="wl-card flex flex-col gap-2 p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-wl-muted">Financial readiness</p>
          <p className="font-display text-4xl font-semibold text-wl-secondary">{c.level}</p>
        </div>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-full border border-wl-border px-5 py-2.5 text-sm text-wl-muted"
        >
          Generate statement — Coming soon
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Income (monthly)" value={c.incomeMonthly} />
        <MetricCard label="Expenses (monthly)" value={c.expensesMonthly} />
        <MetricCard label="Monthly surplus" value={c.monthlySurplus} tone="success" />
        <MetricCard label="Debt burden" value={formatPercent(c.debtBurdenRatio * 100, 1)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Liquid assets" value={c.liquidAssets} />
        <MetricCard label="Investments" value={c.investments} />
        <MetricCard label="Liabilities" value={c.liabilities} tone="danger" />
        <MetricCard label="Savings consistency" value={`${c.savingsConsistency}/100`} />
      </div>
      <div className="wl-card p-5">
        <h3 className="font-display text-lg font-semibold">Readiness notes</h3>
        <ul className="mt-3 space-y-2 text-sm text-wl-muted">
          {c.notes.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-wl-muted">
          {c.disclaimer} · History window: {c.historyMonths} months · Updated{" "}
          {formatRelative(c.lastUpdated)} · Sample income reference {formatKes(c.incomeMonthly)}
        </p>
      </div>
    </div>
  );
}
