"use client";

import { RecordManager, type FieldSpec } from "@/components/financial/RecordManager";
import { MetricCard, PageHeader, StatusPill } from "@/components/ui/primitives";
import { assetsApi } from "@/lib/api/resources";
import { useEntityData } from "@/lib/context/EntityContext";
import { formatKes } from "@/lib/format";

const FIELDS: FieldSpec[] = [
  { key: "name", label: "Name", placeholder: "Toyota Fielder" },
  { key: "category", label: "Category", placeholder: "Vehicle" },
  { key: "value", label: "Value (KES)", kind: "number", placeholder: "780000" },
  {
    key: "liquidity",
    label: "How quickly can you sell it?",
    kind: "select",
    options: [
      { value: "illiquid", label: "Illiquid — hard to sell" },
      { value: "semi_liquid", label: "Semi-liquid — weeks" },
      { value: "liquid", label: "Liquid — days" },
    ],
  },
];

export default function AssetsPage() {
  const data = useEntityData();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Assets" subtitle="Non-investment holdings that contribute to net worth." />
      <MetricCard label="Total assets (this entity)" value={data.assets} />

      <RecordManager
        title="Your assets"
        addLabel="Add asset"
        fields={FIELDS}
        items={data.assetsList}
        api={assetsApi}
        emptyMessage="No assets recorded yet. Add what you own and it will count toward net worth."
        toValues={(a) => ({
          name: a.name,
          category: a.category,
          value: a.value,
          liquidity: a.liquidity,
        })}
        toPayload={(v) => ({
          name: String(v.name),
          category: String(v.category),
          value: Number(v.value),
          liquidity: String(v.liquidity),
        })}
        renderItem={(a, controls) => (
          <article className="wl-card flex items-start justify-between gap-3 p-5">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{a.name}</h3>
                <StatusPill status={a.provenance} />
              </div>
              <p className="text-xs capitalize text-wl-muted">
                {a.category} · {a.liquidity.replaceAll("_", " ")}
              </p>
              <p className="mt-3 font-display text-2xl font-semibold tabular-nums">
                {formatKes(a.value)}
              </p>
            </div>
            {controls}
          </article>
        )}
      />
    </div>
  );
}
