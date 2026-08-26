"use client";

import { RecordManager, type FieldSpec } from "@/components/financial/RecordManager";
import { MetricCard, PageHeader, StatusPill } from "@/components/ui/primitives";
import { accountsApi } from "@/lib/api/resources";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import { formatKes, formatRelative } from "@/lib/format";

const FIELDS: FieldSpec[] = [
  { key: "name", label: "Account name", placeholder: "M-Pesa" },
  {
    key: "provider",
    label: "Type",
    kind: "select",
    options: [
      { value: "mpesa", label: "M-Pesa" },
      { value: "bank", label: "Bank" },
      { value: "sacco", label: "SACCO" },
      { value: "cash", label: "Cash" },
      { value: "mmf", label: "Money market fund" },
      { value: "other", label: "Other" },
    ],
  },
  { key: "institution", label: "Institution", placeholder: "Safaricom" },
  { key: "balance", label: "Balance (KES)", kind: "number", placeholder: "24500" },
  { key: "accountMask", label: "Last 4 digits", required: false, placeholder: "••• 4481" },
  {
    key: "isLiquid",
    label: "Can you spend it today?",
    kind: "select",
    options: [
      { value: "true", label: "Yes — counts as liquid" },
      { value: "false", label: "No — locked or long-term" },
    ],
    hint: "Liquid balances drive your safe-to-spend figure.",
  },
];

export default function AccountsPage() {
  const { entityType } = useEntity();
  const data = useEntityData();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Accounts"
        subtitle={`${entityType} liquid and deposit accounts. Connection status is labelled honestly.`}
      />
      <MetricCard label="Liquid balance" value={data.liquid} hint="What you can reach today" />

      <RecordManager
        title="Your accounts"
        addLabel="Add account"
        fields={FIELDS}
        items={data.accounts}
        api={accountsApi}
        emptyMessage="No accounts yet. Add where your money sits to start tracking it."
        toValues={(a) => ({
          name: a.name,
          provider: a.provider,
          institution: a.institution,
          balance: a.balance,
          accountMask: a.accountMask ?? "",
          isLiquid: String(a.isLiquid ?? true),
        })}
        toPayload={(v) => ({
          name: String(v.name),
          provider: String(v.provider),
          institution: String(v.institution),
          balance: Number(v.balance),
          accountMask: String(v.accountMask ?? "") || null,
          isLiquid: String(v.isLiquid) === "true",
        })}
        renderItem={(a, controls) => (
          <article className="cf-card flex items-start justify-between gap-3 p-5">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{a.name}</h3>
                <StatusPill status={a.connectionStatus} />
              </div>
              <p className="text-xs text-cf-muted">
                {a.institution}
                {a.accountMask ? ` · ${a.accountMask}` : ""}
              </p>
              <p className="mt-3 font-display text-2xl font-semibold tabular-nums">
                {formatKes(a.balance)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-cf-muted">
                <StatusPill status={a.provenance} />
                <span>Updated {formatRelative(a.lastUpdated)}</span>
                {!a.isLiquid && <span>· not counted as liquid</span>}
              </div>
            </div>
            {controls}
          </article>
        )}
      />
    </div>
  );
}
