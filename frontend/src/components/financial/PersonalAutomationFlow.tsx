"use client";

import { setPersonalAutomation } from "@/lib/api/coach";
import type { PersonalCoachHome } from "@/lib/types";
import { formatKes, cn } from "@/lib/format";
import Link from "next/link";
import { useState } from "react";

const FLOW = [
  { id: "income", label: "Income" },
  { id: "bills", label: "Bills & expenses" },
  { id: "emergency", label: "Emergency fund" },
  { id: "surplus", label: "Safe surplus" },
  { id: "rank", label: "Rank markets" },
  { id: "route", label: "Invest" },
] as const;

export function PersonalAutomationFlow({
  coach,
  onRefresh,
}: {
  coach: PersonalCoachHome;
  onRefresh?: (next: PersonalCoachHome) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = coach.automation?.enabled ?? true;
  const advice = coach.investmentAdvice;
  const allocations = advice.allocations ?? [];

  // Progress through the loop for visual status
  const stepState = (id: string): "done" | "active" | "pending" | "skipped" => {
    if (id === "income" || id === "bills") return "done";
    if (id === "emergency") return coach.emergency.intact ? "done" : "active";
    if (id === "surplus") {
      if (!coach.emergency.intact) return "pending";
      return coach.safeToInvest > 0 ? "done" : "active";
    }
    if (id === "rank") {
      if (!advice.allowed) return "pending";
      return allocations.length ? "done" : "active";
    }
    // route / invest
    if (!advice.allowed || !allocations.length) return "pending";
    if (!enabled) return "skipped";
    return advice.autonomous ? "active" : "pending";
  };

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await setPersonalAutomation(!enabled);
      if (res.coach) onRefresh?.(res.coach);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update automation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cf-card space-y-5 p-4 sm:p-5 animate-fade-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cf-primary">
            Automation flow
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-cf-text">
            {enabled ? "Autonomous surplus investing" : "Recommendations only"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-cf-muted">
            {enabled
              ? "After expenses and emergency savings, safe surplus is ranked into the best MMF, bonds, or equities and routed automatically (demo)."
              : "Automation is off. You still get the best market picks below and on Market Intelligence — nothing moves until you act."}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={busy}
            onClick={() => void toggle()}
            className={cn(
              "relative inline-flex h-10 w-[4.5rem] items-center rounded-full border transition-colors disabled:opacity-60",
              enabled ? "border-cf-success/40 bg-cf-success/20" : "border-cf-border bg-[var(--cf-inset)]",
            )}
          >
            <span
              className={cn(
                "absolute h-8 w-8 rounded-full bg-cf-surface shadow transition-transform",
                enabled ? "translate-x-9" : "translate-x-1",
              )}
            />
            <span className="sr-only">{enabled ? "Disable automation" : "Enable automation"}</span>
          </button>
          <p className="text-center text-xs font-medium text-cf-muted sm:text-right">
            {busy ? "Updating…" : enabled ? "Enabled" : "Disabled"}
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-cf-danger/30 bg-cf-danger/10 px-3 py-2 text-sm text-cf-danger">
          {error}
        </p>
      )}

      <div className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-1">
        <ol className="flex min-w-[640px] items-stretch gap-2">
          {FLOW.map((step, i) => {
            const state = stepState(step.id);
            return (
              <li key={step.id} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    "flex min-h-[4.5rem] w-full flex-col justify-center rounded-xl border px-3 py-2",
                    state === "done" && "border-cf-success/40 bg-cf-success/10",
                    state === "active" && "border-cf-primary/40 bg-cf-primary/10",
                    state === "skipped" && "border-dashed border-cf-border bg-transparent",
                    state === "pending" && "border-cf-border bg-[var(--cf-inset)]",
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-cf-muted">
                    Step {i + 1}
                  </span>
                  <span className="mt-0.5 text-sm font-medium text-cf-text">{step.label}</span>
                  <span
                    className={cn(
                      "mt-1 text-[10px] font-semibold uppercase",
                      state === "done" && "text-cf-success",
                      state === "active" && "text-cf-primary",
                      state === "skipped" && "text-cf-warning",
                      state === "pending" && "text-cf-muted",
                    )}
                  >
                    {state === "done"
                      ? "Done"
                      : state === "active"
                        ? enabled && step.id === "route"
                          ? "Routing"
                          : "Now"
                        : state === "skipped"
                          ? "Paused"
                          : "Waiting"}
                  </span>
                </div>
                {i < FLOW.length - 1 && (
                  <span className="shrink-0 text-cf-muted" aria-hidden>
                    →
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-cf-border bg-[var(--cf-inset)] px-3 py-3">
          <p className="text-[10px] uppercase tracking-wide text-cf-muted">Safe to invest</p>
          <p className="mt-1 font-display text-lg font-semibold text-cf-text">
            {formatKes(coach.safeToInvest)}
          </p>
        </div>
        <div className="rounded-xl border border-cf-border bg-[var(--cf-inset)] px-3 py-3">
          <p className="text-[10px] uppercase tracking-wide text-cf-muted">Plan</p>
          <p className="mt-1 text-sm font-semibold text-cf-text">{advice.title}</p>
        </div>
        <div className="rounded-xl border border-cf-border bg-[var(--cf-inset)] px-3 py-3">
          <p className="text-[10px] uppercase tracking-wide text-cf-muted">Mode</p>
          <p className="mt-1 text-sm font-semibold text-cf-text">
            {enabled ? "Autonomous" : "Recommend only"}
          </p>
        </div>
      </div>

      {advice.allowed && allocations.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {allocations.map((leg) => (
            <article
              key={`${leg.instrumentId}-${leg.role}`}
              className="rounded-xl border border-cf-primary/30 bg-cf-primary/5 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-cf-primary">
                    {enabled ? "Auto-routing" : "Recommended"} · {leg.role}
                  </p>
                  <p className="mt-0.5 font-medium text-cf-text">{leg.name}</p>
                </div>
                <p className="shrink-0 font-display text-sm font-semibold text-cf-primary">
                  {Math.round(leg.weight * 100)}%
                </p>
              </div>
              <p className="mt-2 text-sm font-semibold text-cf-text">{formatKes(leg.amount)}</p>
              <p className="mt-1 text-xs text-cf-muted">
                {leg.yieldValue} · {leg.risk} risk
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-cf-muted">{advice.plainAdvice}</p>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/automation" className="font-semibold text-cf-primary hover:underline">
          Full automation settings →
        </Link>
        <Link href="/intelligence" className="text-cf-muted hover:text-cf-text hover:underline">
          Market intelligence
        </Link>
      </div>
    </section>
  );
}
