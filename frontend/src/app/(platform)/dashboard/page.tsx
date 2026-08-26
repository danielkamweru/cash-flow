"use client";

import { CashFlowChart, NetWorthHero } from "@/components/financial/Charts";
import { RecommendationHero, WealthHealthBadge } from "@/components/financial/RecommendationHero";
import { SafeSurplusPanel } from "@/components/financial/SafeSurplusPanel";
import { TrafficLightHome } from "@/components/financial/TrafficLightHome";
import { PersonalAutomationFlow } from "@/components/financial/PersonalAutomationFlow";
import { GoalCard } from "@/components/financial/Cards";
import { PageHeader, StatusPill } from "@/components/ui/primitives";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import { fetchPersonalCoach } from "@/lib/api/coach";
import type { PersonalCoachHome } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function DashboardPage() {
  const { entityType } = useEntity();
  const data = useEntityData();
  const latest = data.cashflow[data.cashflow.length - 1];
  const monthlyFlow = (latest?.inflow ?? 0) - (latest?.outflow ?? 0);
  const primaryRec = data.recommendations[0];
  const isPersonal = entityType === "PERSONAL";
  const [coach, setCoach] = useState<PersonalCoachHome | null>(null);
  const [coachError, setCoachError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPersonal) {
      setCoach(null);
      setCoachError(null);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const remote = await fetchPersonalCoach();
        if (!cancelled) {
          setCoach(remote);
          setCoachError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setCoach(null);
          setCoachError(e instanceof Error ? e.message : "Coach API unavailable");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isPersonal]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={isPersonal ? "Your money today" : "Business command centre"}
        subtitle={
          isPersonal
            ? "Live snapshot from the API — surplus, automation, and next actions."
            : "Where am I · what is happening · what can I safely use · what should I do next."
        }
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status="connected" />
            <span className="text-xs text-cf-muted">Updated {formatRelative(data.asOf)}</span>
          </div>
        }
      />

      {isPersonal && coachError && (
        <div className="rounded-xl border border-cf-danger/40 bg-cf-danger/10 px-4 py-3 text-sm text-cf-danger">
          Personal coach could not load: {coachError}. Restart the FastAPI backend on port 4000.
        </div>
      )}

      {isPersonal && coach && (
        <>
          <TrafficLightHome coach={coach} onRefresh={(next) => setCoach(next)} />
          <PersonalAutomationFlow coach={coach} onRefresh={(next) => setCoach(next)} />
        </>
      )}

      <NetWorthHero
        netWorth={data.netWorth}
        liquid={data.liquid}
        investments={data.investments}
        liabilities={data.liabilities}
        monthlyFlow={monthlyFlow}
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <SafeSurplusPanel surplus={data.surplus} />
        <div className="space-y-4">
          <WealthHealthBadge health={data.health} />
          <div className="cf-card p-4">
            <p className="text-[11px] uppercase tracking-wide text-cf-muted">Am I getting better?</p>
            <p className="mt-1 text-sm text-cf-text-secondary">
              Wealth Health tracks buffers, debt, savings and goals — not a CRB score.
            </p>
            <Link href="/wealth-health" className="mt-3 inline-block text-sm text-cf-primary hover:underline">
              Open Wealth Health →
            </Link>
          </div>
        </div>
      </div>

      {primaryRec && <RecommendationHero recommendation={primaryRec} surplusInvest={data.surplus.safeToInvest} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <CashFlowChart series={data.cashflow} />
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Goals</h2>
            <Link href="/goals" className="text-sm text-cf-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {data.goals.slice(0, 3).map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
