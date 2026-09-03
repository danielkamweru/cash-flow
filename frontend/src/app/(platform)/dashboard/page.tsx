"use client";

import { CashFlowChart, NetWorthHero } from "@/components/financial/Charts";
import { RecommendationHero, WealthHealthBadge } from "@/components/financial/RecommendationHero";
import { SafeSurplusPanel } from "@/components/financial/SafeSurplusPanel";
import { TrafficLightHome } from "@/components/financial/TrafficLightHome";
import { PersonalAutomationFlow } from "@/components/financial/PersonalAutomationFlow";
import { GoalCard } from "@/components/financial/Cards";
import { PageHeader, StatusPill } from "@/components/ui/primitives";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import { fetchPersonalCoach } from "@/lib/api/coach";
import type { PersonalCoachHome, Transaction } from "@/lib/types";
import { cn, formatRelative } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type RangePreset = "today" | "week" | "month" | "last_month" | "3months" | "custom";

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "3months", label: "Last 3 months" },
  { key: "custom", label: "Custom" },
];

function presetRange(key: RangePreset): [string, string] {
  const now = new Date();
  const today = toInputDate(now);
  switch (key) {
    case "today":
      return [today, today];
    case "week": {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      return [toInputDate(start), today];
    }
    case "month":
      return [toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), today];
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return [toInputDate(first), toInputDate(last)];
    }
    case "3months": {
      const start = new Date(now);
      start.setMonth(now.getMonth() - 3);
      return [toInputDate(start), today];
    }
    default:
      return [toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), today];
  }
}

// ---------------------------------------------------------------------------
// Derive a cashflow series from raw transactions for the selected range
// ---------------------------------------------------------------------------

function buildCashflow(
  transactions: Transaction[],
  start: string,
  end: string,
): { month: string; inflow: number; outflow: number }[] {
  const filtered = transactions.filter((t) => {
    const d = t.date.slice(0, 10);
    return d >= start && d <= end;
  });

  const map = new Map<string, { inflow: number; outflow: number }>();
  for (const t of filtered) {
    const month = t.date.slice(0, 7); // YYYY-MM
    const entry = map.get(month) ?? { inflow: 0, outflow: 0 };
    if (t.type === "inflow") entry.inflow += t.amount;
    else if (t.type === "outflow") entry.outflow += t.amount;
    map.set(month, entry);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month: new Date(month + "-01").toLocaleString("default", { month: "short" }),
      ...v,
    }));
}

// ---------------------------------------------------------------------------
// Date range filter bar
// ---------------------------------------------------------------------------

function DateRangeBar({
  preset,
  start,
  end,
  onPreset,
  onRange,
}: {
  preset: RangePreset;
  start: string;
  end: string;
  onPreset: (p: RangePreset) => void;
  onRange: (start: string, end: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onPreset(p.key)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            preset === p.key
              ? "border-cf-primary/50 bg-cf-primary/10 text-cf-text"
              : "border-cf-border text-cf-muted hover:border-cf-primary/40 hover:text-cf-text",
          )}
        >
          {p.label}
        </button>
      ))}
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={start}
            max={end || undefined}
            onChange={(e) => onRange(e.target.value, end)}
            className="rounded-xl border border-cf-border bg-cf-surface-2 px-3 py-1.5 text-xs text-cf-text outline-none focus:border-cf-primary/50"
          />
          <span className="text-xs text-cf-muted">to</span>
          <input
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => onRange(start, e.target.value)}
            className="rounded-xl border border-cf-border bg-cf-surface-2 px-3 py-1.5 text-xs text-cf-text outline-none focus:border-cf-primary/50"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { entityType } = useEntity();
  const data = useEntityData();
  const isPersonal = entityType === "PERSONAL";
  const primaryRec = data.recommendations[0];

  // Coach
  const [coach, setCoach] = useState<PersonalCoachHome | null>(null);
  const [coachLoading, setCoachLoading] = useState(isPersonal);
  const [coachError, setCoachError] = useState<string | null>(null);

  function loadCoach() {
    if (!isPersonal) return;
    setCoachLoading(true);
    setCoachError(null);
    let cancelled = false;
    fetchPersonalCoach()
      .then((remote) => { if (!cancelled) { setCoach(remote); setCoachLoading(false); } })
      .catch((e) => { if (!cancelled) { setCoachError(e instanceof Error ? e.message : "Unavailable"); setCoachLoading(false); } });
    return () => { cancelled = true; };
  }

  useEffect(() => {
    const cleanup = loadCoach();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPersonal]);

  // Date range
  const [preset, setPreset] = useState<RangePreset>("month");
  const [[start, end], setRange] = useState<[string, string]>(() => presetRange("month"));

  function handlePreset(p: RangePreset) {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  }

  // Filtered cashflow derived from transactions in range
  const filteredCashflow = useMemo(
    () => buildCashflow(data.transactions, start, end),
    [data.transactions, start, end],
  );

  // Filtered transactions for the range (for empty state count)
  const filteredTxns = useMemo(
    () => data.transactions.filter((t) => {
      const d = t.date.slice(0, 10);
      return d >= start && d <= end;
    }),
    [data.transactions, start, end],
  );

  const latest = filteredCashflow[filteredCashflow.length - 1];
  const monthlyFlow = (latest?.inflow ?? 0) - (latest?.outflow ?? 0);

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

      {/* Date range filter */}
      <DateRangeBar
        preset={preset}
        start={start}
        end={end}
        onPreset={handlePreset}
        onRange={(s, e) => setRange([s, e])}
      />

      {/* Coach section */}
      {isPersonal && (
        <>
          {coachLoading && (
            <div className="grid gap-6 lg:grid-cols-2">
              <SkeletonCard className="min-h-[120px]" />
              <SkeletonCard className="min-h-[120px]" />
            </div>
          )}
          {!coachLoading && coachError && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-cf-border bg-cf-surface px-4 py-3">
              <p className="text-sm text-cf-muted">
                Live coach data couldn&apos;t load.
              </p>
              <button
                type="button"
                onClick={loadCoach}
                className="shrink-0 rounded-full border border-cf-border px-3 py-1.5 text-xs font-semibold text-cf-muted hover:text-cf-text"
              >
                Try again
              </button>
            </div>
          )}
          {!coachLoading && coach && (
            <>
              <TrafficLightHome coach={coach} onRefresh={(next) => setCoach(next)} />
              <PersonalAutomationFlow coach={coach} onRefresh={(next) => setCoach(next)} />
            </>
          )}
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
        {/* Cash flow chart — filtered by date range */}
        {filteredCashflow.length > 0 ? (
          <CashFlowChart series={filteredCashflow} />
        ) : (
          <div className="cf-card flex flex-col items-center justify-center px-6 py-12 text-center">
            <p className="font-display text-base font-semibold text-cf-text">No cash flow data</p>
            <p className="mt-1 text-sm text-cf-muted">
              No transactions found for the selected period.
            </p>
            <Link
              href="/transactions"
              className="mt-4 rounded-full border border-cf-primary/40 px-4 py-2 text-xs font-semibold text-cf-text hover:bg-cf-primary/10"
            >
              View transactions
            </Link>
          </div>
        )}

        {/* Goals */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Goals</h2>
            <Link href="/goals" className="text-sm text-cf-primary hover:underline">
              View all
            </Link>
          </div>
          {data.goals.length > 0 ? (
            <div className="space-y-3">
              {data.goals.slice(0, 3).map((g) => (
                <GoalCard key={g.id} goal={g} />
              ))}
            </div>
          ) : (
            <div className="cf-card flex flex-col items-center justify-center px-6 py-12 text-center">
              <p className="font-display text-base font-semibold text-cf-text">No goals yet</p>
              <p className="mt-1 text-sm text-cf-muted">
                Give your surplus a destination — emergency fund, education, property.
              </p>
              <Link
                href="/goals"
                className="mt-4 rounded-full border border-cf-primary/40 px-4 py-2 text-xs font-semibold text-cf-text hover:bg-cf-primary/10"
              >
                Add a goal
              </Link>
            </div>
          )}
        </section>
      </div>

      {/* Recent transactions empty state */}
      {filteredTxns.length === 0 && data.transactions.length > 0 && (
        <div className="cf-card flex flex-col items-center justify-center px-6 py-10 text-center">
          <p className="font-display text-base font-semibold text-cf-text">No transactions in this period</p>
          <p className="mt-1 text-sm text-cf-muted">Try a wider date range to see your activity.</p>
        </div>
      )}
      {data.transactions.length === 0 && (
        <div className="cf-card flex flex-col items-center justify-center px-6 py-12 text-center">
          <p className="font-display text-base font-semibold text-cf-text">No transactions yet</p>
          <p className="mt-1 text-sm text-cf-muted">
            Your recent transactions will appear here once you start recording activity.
          </p>
          <Link
            href="/transactions"
            className="mt-4 rounded-full border border-cf-primary/40 px-4 py-2 text-xs font-semibold text-cf-text hover:bg-cf-primary/10"
          >
            Go to transactions
          </Link>
        </div>
      )}
    </div>
  );
}
