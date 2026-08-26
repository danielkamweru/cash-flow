"use client";

import { ComingSoonBanner, PageHeader, StatusPill } from "@/components/ui/primitives";
import { fetchPersonalCoach } from "@/lib/api/coach";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import type { InvestmentAllocation, PersonalCoachHome } from "@/lib/types";
import { formatKes, cn } from "@/lib/format";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const LABELS: Record<string, string> = {
  mmf: "Money Market Funds",
  nse: "NSE",
  tbill: "Treasury Bills",
  tbond: "Treasury Bonds",
  infra_bond: "Infrastructure Bonds",
};

export default function IntelligencePage() {
  const { entityType } = useEntity();
  const data = useEntityData();
  const isPersonal = entityType === "PERSONAL";
  const [coach, setCoach] = useState<PersonalCoachHome | null>(null);
  const groups = ["mmf", "nse", "tbill", "tbond"] as const;

  useEffect(() => {
    if (!isPersonal) {
      setCoach(null);
      return;
    }
    let cancelled = false;
    void fetchPersonalCoach()
      .then((remote) => {
        if (!cancelled) setCoach(remote);
      })
      .catch(() => {
        if (!cancelled) setCoach(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isPersonal]);

  const recommendedIds = useMemo(() => {
    const set = new Set<string>();
    for (const leg of coach?.investmentAdvice.allocations ?? []) {
      set.add(leg.instrumentId);
    }
    return set;
  }, [coach]);

  const allocations: InvestmentAllocation[] = coach?.investmentAdvice.allocations ?? [];
  const automationOff = coach?.automation?.enabled === false;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Investment intelligence"
        subtitle="Compare opportunities across MMFs, NSE, and CBK securities — with honest data labels."
      />
      <ComingSoonBanner feature="Live market feeds (NSE, CBK/DhowCSD, MMF providers)" />

      {isPersonal && coach && (
        <section className="wl-card space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-wl-secondary">
                Personal surplus plan
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold text-wl-text">
                {coach.investmentAdvice.title}
              </h2>
              <p className="mt-2 text-sm text-wl-muted">{coach.investmentAdvice.plainAdvice}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                  coach.automation?.enabled
                    ? "bg-wl-success/15 text-wl-success"
                    : "bg-wl-warning/15 text-wl-warning",
                )}
              >
                {coach.automation?.enabled ? "Autonomous" : "Recommend only"}
              </span>
              {coach.investmentAdvice.allowed && (
                <p className="text-sm font-semibold text-wl-text">
                  {formatKes(coach.investmentAdvice.suggestedAmount)} to allocate
                </p>
              )}
            </div>
          </div>

          {automationOff && (
            <p className="rounded-xl border border-wl-warning/30 bg-wl-warning/10 px-3 py-2 text-sm text-wl-text-secondary">
              Automation is disabled — these are the best market options for your surplus. Enable
              autonomous routing anytime on the{" "}
              <Link href="/automation" className="font-semibold text-wl-secondary hover:underline">
                Automation
              </Link>{" "}
              tab.
            </p>
          )}

          {allocations.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {allocations.map((leg) => (
                <article
                  key={`${leg.instrumentId}-${leg.role}`}
                  className="rounded-xl border border-wl-primary/30 bg-wl-primary/5 p-4"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-wl-secondary">
                    Recommended · {leg.role}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold">{leg.name}</h3>
                  <p className="text-xs text-wl-muted">{leg.provider}</p>
                  <p className="mt-3 font-display text-xl font-semibold text-wl-text">
                    {formatKes(leg.amount)}
                  </p>
                  <p className="text-xs text-wl-muted">
                    {Math.round(leg.weight * 100)}% · {leg.yieldValue} · {leg.risk}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-wl-muted">
              {coach.investmentAdvice.allowed
                ? "No instruments matched current minimums."
                : coach.investmentAdvice.plainAdvice}
            </p>
          )}
        </section>
      )}

      {groups.map((type) => {
        const items = data.markets.filter((m) => m.type === type || (type === "tbond" && m.type === "infra_bond"));
        if (!items.length) return null;
        return (
          <section key={type}>
            <h2 className="mb-3 font-display text-xl font-semibold">{LABELS[type]}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((m) => {
                const isPick = recommendedIds.has(m.id);
                return (
                  <article
                    key={m.id}
                    className={cn(
                      "wl-card p-5",
                      isPick && "border-wl-primary/40 ring-1 ring-wl-primary/20",
                    )}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-lg font-semibold">{m.name}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {isPick && (
                          <span className="rounded-md bg-wl-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-wl-secondary">
                            Best for you
                          </span>
                        )}
                        <StatusPill status={m.dataStatus} />
                      </div>
                    </div>
                    <p className="text-xs text-wl-muted">{m.provider}</p>
                    <p className="mt-3 text-sm text-wl-muted">{m.yieldLabel}</p>
                    <p className="font-display text-2xl font-semibold text-wl-secondary">{m.yieldValue}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-wl-muted">
                      <div>
                        <dt>Risk</dt>
                        <dd className="text-wl-text">{m.risk}</dd>
                      </div>
                      <div>
                        <dt>Liquidity</dt>
                        <dd className="text-wl-text">{m.liquidity}</dd>
                      </div>
                      <div>
                        <dt>Min investment</dt>
                        <dd className="text-wl-text">{formatKes(m.minInvestment)}</dd>
                      </div>
                      {m.asOf && (
                        <div>
                          <dt>As of</dt>
                          <dd className="text-wl-text">{m.asOf.slice(0, 10)}</dd>
                        </div>
                      )}
                    </dl>
                    {m.notes && <p className="mt-3 text-xs text-wl-muted">{m.notes}</p>}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
