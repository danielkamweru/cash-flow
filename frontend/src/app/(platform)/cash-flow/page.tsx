"use client";

import { CashFlowChart } from "@/components/financial/Charts";
import { MetricCard, PageHeader } from "@/components/ui/primitives";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import { formatKes } from "@/lib/format";

export default function CashFlowPage() {
  const data = useEntityData();
  const latest = data.cashflow[data.cashflow.length - 1];
  const avgIn =
    data.cashflow.reduce((s, m) => s + m.inflow, 0) / Math.max(data.cashflow.length, 1);
  const avgOut =
    data.cashflow.reduce((s, m) => s + m.outflow, 0) / Math.max(data.cashflow.length, 1);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Cash flow"
        subtitle="What is happening with money in and out — foundation for surplus and readiness."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Latest inflow" value={latest?.inflow ?? 0} badge="Demo" />
        <MetricCard label="Latest outflow" value={latest?.outflow ?? 0} badge="Demo" />
        <MetricCard
          label="Latest net"
          value={formatKes((latest?.inflow ?? 0) - (latest?.outflow ?? 0), { signed: true })}
          tone="success"
        />
      </div>
      <CashFlowChart series={data.cashflow} />
      <div className="cf-card grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs text-cf-muted">Average monthly inflow</p>
          <p className="font-display text-xl font-semibold">{formatKes(avgIn)}</p>
        </div>
        <div>
          <p className="text-xs text-cf-muted">Average monthly outflow</p>
          <p className="font-display text-xl font-semibold">{formatKes(avgOut)}</p>
        </div>
      </div>
    </div>
  );
}
