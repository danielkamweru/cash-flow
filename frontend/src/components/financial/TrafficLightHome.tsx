"use client";

import { executeLoopAction } from "@/lib/api/coach";
import type { PersonalCoachHome } from "@/lib/types";
import { formatKes, cn } from "@/lib/format";
import Link from "next/link";
import { useState } from "react";

const LIGHT: Record<
  PersonalCoachHome["trafficLight"],
  { label: string; bar: string; chip: string }
> = {
  green: {
    label: "SAFE TO SPEND TODAY",
    bar: "bg-wl-success",
    chip: "bg-wl-success/15 text-wl-success",
  },
  amber: {
    label: "BE CAREFUL TODAY",
    bar: "bg-wl-warning",
    chip: "bg-wl-warning/15 text-wl-warning",
  },
  red: {
    label: "STOP AND CHECK",
    bar: "bg-wl-danger",
    chip: "bg-wl-danger/15 text-wl-danger",
  },
};

export function TrafficLightHome({
  coach,
  onRefresh,
}: {
  coach: PersonalCoachHome;
  onRefresh?: (next: PersonalCoachHome) => void;
}) {
  const theme = LIGHT[coach.trafficLight];
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(actionId: string) {
    setBusy(actionId);
    setError(null);
    try {
      const res = await executeLoopAction(actionId);
      onRefresh?.(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete action");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4 animate-fade-up">
      <div className="wl-card overflow-hidden">
        <div className={cn("h-2 w-full", theme.bar)} />
        <div className="p-5 md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide", theme.chip)}>
              {theme.label}
            </span>
            <span className="text-[11px] text-wl-muted">Simple money check · Personal</span>
          </div>
          <p className="mt-3 max-w-2xl text-base text-wl-text-secondary md:text-lg">{coach.headline}</p>
          <p className="mt-5 break-words font-display text-3xl font-semibold tracking-tight text-wl-text sm:text-4xl md:text-5xl">
            {formatKes(coach.safeToSpendToday)}
          </p>
          <p className="mt-1 text-sm text-wl-muted">
            Money you can use today after bills and emergency savings are protected
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-wl-border bg-[var(--wealth-inset)] px-3 py-3">
              <p className="text-[10px] uppercase tracking-wide text-wl-muted">Emergency money</p>
              <p className="mt-1 text-sm font-semibold text-wl-text">
                {coach.emergency.intact ? "Intact" : "Needs care"}
              </p>
              <p className="mt-1 text-xs text-wl-muted">{coach.emergency.plainStatus}</p>
            </div>
            <div className="rounded-xl border border-wl-border bg-[var(--wealth-inset)] px-3 py-3">
              <p className="text-[10px] uppercase tracking-wide text-wl-muted">Next bill</p>
              {coach.nextBill ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-wl-text">{coach.nextBill.name}</p>
                  <p className="mt-1 text-xs text-wl-muted">
                    {formatKes(coach.nextBill.amount)} · in {coach.nextBill.daysUntilDue} days
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-wl-muted">No open bills</p>
              )}
            </div>
            <div className="rounded-xl border border-wl-border bg-[var(--wealth-inset)] px-3 py-3">
              <p className="text-[10px] uppercase tracking-wide text-wl-muted">Safe to invest</p>
              <p className="mt-1 text-sm font-semibold text-wl-text">{formatKes(coach.safeToInvest)}</p>
              <p className="mt-1 text-xs text-wl-muted">
                {coach.investmentAdvice.allowed ? "Advice unlocked" : "Locked until safer"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {coach.runway.plainShortfallMessage && (
        <div className="rounded-xl border border-wl-danger/40 bg-wl-danger/10 px-4 py-3 text-sm text-wl-danger">
          {coach.runway.plainShortfallMessage}
        </div>
      )}

      {coach.warnings.filter((w) => w !== coach.runway.plainShortfallMessage).length > 0 && (
        <div className="wl-card space-y-2 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-wl-secondary">
            Things to watch
          </p>
          <ul className="space-y-1.5 text-sm text-wl-text-secondary">
            {coach.warnings
              .filter((w) => w !== coach.runway.plainShortfallMessage)
              .slice(0, 5)
              .map((w) => (
                <li key={w}>• {w}</li>
              ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="wl-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Spending pockets</h3>
            <Link href="/bills" className="text-sm text-wl-secondary hover:underline">
              Bills
            </Link>
          </div>
          <ul className="space-y-3">
            {coach.envelopes.map((e) => (
              <li key={e.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-wl-text">{e.name}</span>
                  <span className="text-wl-muted">
                    {formatKes(e.spentAmount)} / {formatKes(e.monthlyLimit)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--wealth-inset)]">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      e.utilizationPct >= 100
                        ? "bg-wl-danger"
                        : e.utilizationPct >= 80
                          ? "bg-wl-warning"
                          : "bg-wl-success",
                    )}
                    style={{ width: `${Math.min(100, e.utilizationPct)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-wl-muted">{e.plainStatus}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="wl-card p-5">
          <h3 className="font-display text-lg font-semibold">What to do with LOOP</h3>
          <p className="mt-1 text-xs text-wl-muted">
            Actions use your mapped LOOP APIs (Paybill / Send Money) — only after you confirm.
          </p>
          {error && <p className="mt-3 text-sm text-wl-danger">{error}</p>}
          <ul className="mt-4 space-y-3">
            {coach.loopActions.map((a) => (
              <li key={a.actionId} className="rounded-xl border border-wl-border p-3">
                <p className="text-sm font-semibold text-wl-text">{a.title}</p>
                <p className="mt-1 text-xs text-wl-muted">{a.plainReason}</p>
                <p className="mt-1 text-[11px] text-wl-muted">
                  {a.loopProduct} · {formatKes(a.amount)}
                </p>
                {a.blockedReason ? (
                  <p className="mt-2 text-xs text-wl-warning">{a.blockedReason}</p>
                ) : a.loopProduct !== "none" ? (
                  <button
                    type="button"
                    disabled={busy === a.actionId}
                    onClick={() => void runAction(a.actionId)}
                    className="mt-3 rounded-full bg-gradient-to-r from-wl-primary to-wl-secondary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {busy === a.actionId ? "Working…" : "Confirm & pay with LOOP"}
                  </button>
                ) : (
                  <Link
                    href="/intelligence"
                    className="mt-3 inline-block text-xs font-semibold text-wl-secondary hover:underline"
                  >
                    See investment options →
                  </Link>
                )}
              </li>
            ))}
            {!coach.loopActions.length && (
              <li className="text-sm text-wl-muted">No LOOP actions needed right now.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="wl-card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold">{coach.investmentAdvice.title}</h3>
            <p className="mt-2 text-sm text-wl-text-secondary">{coach.investmentAdvice.plainAdvice}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {coach.automation && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                  coach.automation.enabled
                    ? "bg-wl-success/15 text-wl-success"
                    : "bg-wl-warning/15 text-wl-warning",
                )}
              >
                {coach.automation.enabled ? "Autonomous" : "Recommend only"}
              </span>
            )}
            <span className="rounded-full border border-wl-border px-2.5 py-1 text-[10px] uppercase tracking-wide text-wl-muted">
              Data · {coach.investmentAdvice.dataStatus}
            </span>
          </div>
        </div>

        {coach.investmentAdvice.allowed && (coach.investmentAdvice.allocations?.length ?? 0) > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {coach.investmentAdvice.allocations!.map((leg) => (
              <article
                key={`${leg.instrumentId}-${leg.role}`}
                className="rounded-xl border border-wl-border bg-[var(--wealth-inset)] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-wl-muted">
                      {leg.role} · {leg.type}
                    </p>
                    <p className="mt-0.5 font-medium text-wl-text">{leg.name}</p>
                    <p className="text-xs text-wl-muted">{leg.provider}</p>
                  </div>
                  <p className="shrink-0 font-display text-sm font-semibold text-wl-secondary">
                    {Math.round(leg.weight * 100)}%
                  </p>
                </div>
                <p className="mt-2 text-sm font-semibold text-wl-text">{formatKes(leg.amount)}</p>
                <p className="mt-1 text-xs text-wl-muted">
                  {leg.yieldLabel}: {leg.yieldValue} · {leg.risk} risk
                </p>
              </article>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link href="/intelligence" className="text-sm font-semibold text-wl-secondary hover:underline">
            Open market intelligence →
          </Link>
          <Link href="/automation" className="text-sm text-wl-muted hover:text-wl-text hover:underline">
            Manage automation
          </Link>
        </div>
      </div>
    </section>
  );
}
