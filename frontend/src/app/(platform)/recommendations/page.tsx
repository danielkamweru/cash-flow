"use client";

import { RecommendationCard } from "@/components/financial/Cards";
import { PageHeader } from "@/components/ui/primitives";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";

export default function RecommendationsPage() {
  const data = useEntityData();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Recommendations"
        subtitle="DATA → ANALYSIS → RECOMMENDATION → YOUR DECISION. Never guaranteed returns."
      />
      <div className="rounded-xl border border-cf-border bg-cf-surface px-4 py-3 text-sm text-cf-muted">
        Recommendations are explainable decision support. Approving an action in demo mode does not
        move real money.
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.recommendations.map((r) => (
          <RecommendationCard key={r.id} rec={r} />
        ))}
      </div>
    </div>
  );
}
