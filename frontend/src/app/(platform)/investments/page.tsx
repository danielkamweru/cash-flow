"use client";

import { RecordManager, type FieldSpec } from "@/components/financial/RecordManager";
import { MetricCard, PageHeader, StatusPill } from "@/components/ui/primitives";
import { investmentsApi } from "@/lib/api/resources";
import { useEntityData } from "@/lib/context/EntityContext";
import { formatKes } from "@/lib/format";

const FIELDS: FieldSpec[] = [
  { key: "name", label: "Name", placeholder: "CIC Money Market Fund" },
  {
    key: "type",
    label: "Instrument",
    kind: "select",
    options: [
      { value: "mmf", label: "Money Market Fund" },
      { value: "sacco", label: "SACCO shares" },
      { value: "tbill", label: "Treasury Bill" },
      { value: "tbond", label: "Treasury Bond" },
      { value: "infra_bond", label: "Infrastructure Bond" },
      { value: "nse", label: "NSE equities" },
      { value: "other", label: "Other" },
    ],
  },
  { key: "value", label: "Current value (KES)", kind: "number", placeholder: "142000" },
  {
    key: "costBasis",
    label: "What you put in (KES)",
    kind: "number",
    required: false,
    hint: "Leave blank if you are not tracking gains.",
  },
  {
    key: "liquidity",
    label: "Access",
    kind: "select",
    options: [
      { value: "daily", label: "Daily — withdraw any time" },
      { value: "tplus2", label: "T+2 — settles in two days" },
      { value: "maturity", label: "At maturity" },
      { value: "locked", label: "Locked" },
    ],
  },
  {
    key: "risk",
    label: "Risk",
    kind: "select",
    options: [
      { value: "low", label: "Low" },
      { value: "moderate", label: "Moderate" },
      { value: "elevated", label: "Elevated" },
      { value: "high", label: "High" },
    ],
  },
  { key: "notes", label: "Notes", required: false, placeholder: "Matures Oct 2026" },
];

export default function InvestmentsPage() {
  const data = useEntityData();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Investments"
        subtitle="MMFs, Treasuries, SACCO shares, and other productive holdings."
      />
      <MetricCard
        label="Investment book"
        value={data.investments}
        hint="Includes SACCO deposits where applicable"
      />

      <RecordManager
        title="Your holdings"
        addLabel="Add holding"
        fields={FIELDS}
        items={data.investmentsList}
        api={investmentsApi}
        emptyMessage="No holdings yet. Add one here, or let the Advisor fund one for you."
        toValues={(i) => ({
          name: i.name,
          type: i.type,
          value: i.value,
          costBasis: i.costBasis ?? "",
          liquidity: i.liquidity,
          risk: i.risk,
          notes: i.notes ?? "",
        })}
        toPayload={(v) => ({
          name: String(v.name),
          type: String(v.type),
          value: Number(v.value),
          costBasis: v.costBasis === "" ? null : Number(v.costBasis),
          liquidity: String(v.liquidity),
          risk: String(v.risk),
          notes: String(v.notes ?? "") || null,
        })}
        renderItem={(inv, controls) => {
          const gain = inv.costBasis != null ? inv.value - inv.costBasis : null;
          return (
            <article className="cf-card flex items-start justify-between gap-3 p-5">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg font-semibold">{inv.name}</h3>
                  <StatusPill status={inv.provenance} />
                </div>
                <p className="text-xs uppercase tracking-wide text-cf-muted">
                  {inv.type} · risk {inv.risk} · {inv.liquidity}
                </p>
                <p className="mt-3 font-display text-2xl font-semibold tabular-nums">
                  {formatKes(inv.value)}
                </p>
                {gain != null && (
                  <p
                    className={`mt-1 text-xs tabular-nums ${gain >= 0 ? "text-cf-success" : "text-cf-danger"}`}
                  >
                    {gain >= 0 ? "+" : "−"}
                    {formatKes(Math.abs(gain))} against {formatKes(inv.costBasis!)} invested
                  </p>
                )}
                {inv.notes && <p className="mt-2 text-xs text-cf-muted">{inv.notes}</p>}
              </div>
              {controls}
            </article>
          );
        }}
      />
    </div>
  );
}
