"use client";

import { WealthHealthBadge } from "@/components/financial/RecommendationHero";
import { PageHeader, ProgressBar } from "@/components/ui/primitives";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";

export default function WealthHealthPage() {
  const data = useEntityData();
  const { health } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Wealth Health"
        subtitle="Legitimate financial-health indicators — never presented as a CRB score."
      />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <WealthHealthBadge health={health} />
        <div className="cf-card space-y-5 p-5">
          {health.factors.map((f) => (
            <div key={f.key}>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-cf-text">{f.label}</span>
                <span className="text-cf-muted">{f.score}/100</span>
              </div>
              <ProgressBar value={f.score / 100} />
              <p className="mt-1 text-xs text-cf-muted">{f.note}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="rounded-xl border border-cf-border bg-cf-surface px-4 py-3 text-xs text-cf-muted">
        {health.disclaimer}
      </p>
      <div className="flex flex-wrap gap-2">
        {(["FOUNDATION", "BUILDER", "GROWING", "STRONG", "ADVANCED"] as const).map((tier) => (
          <span
            key={tier}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              tier === health.tier
                ? "bg-cf-primary text-white"
                : "border border-cf-border text-cf-muted"
            }`}
          >
            {tier}
          </span>
        ))}
      </div>
    </div>
  );
}
