"use client";

import { formatKes, formatRelative } from "@/lib/format";
import type { Recommendation, WealthHealthScore } from "@/lib/types";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export function RecommendationHero({
  recommendation,
  surplusInvest,
}: {
  recommendation?: Recommendation;
  surplusInvest: number;
}) {
  if (!recommendation) {
    return (
      <section className="wl-card p-5 md:p-6">
        <p className="text-sm text-wl-muted">No recommendation for this context yet.</p>
      </section>
    );
  }

  return (
    <section className="wl-card relative overflow-hidden animate-fade-up-delay-2">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-wl-primary/20 blur-3xl" />
      <div className="relative p-5 md:p-6">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-wl-secondary">
          <Sparkles className="h-3.5 w-3.5" />
          Wealth Loop recommendation
        </div>
        <p className="max-w-3xl text-base leading-relaxed text-wl-text md:text-lg">
          {recommendation.summary ||
            `You currently have ${formatKes(surplusInvest)} available after accounting for upcoming obligations and your emergency buffer.`}
        </p>
        <p className="mt-3 font-display text-xl font-semibold text-wl-text">{recommendation.title}</p>
        <ul className="mt-3 space-y-1.5 text-sm text-wl-muted">
          {recommendation.why.slice(0, 3).map((w) => (
            <li key={w} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-wl-secondary" />
              {w}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/recommendations"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-wl-primary to-wl-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-wl-primary/25 transition hover:brightness-110"
          >
            Review next action
            <ArrowRight className="h-4 w-4" />
          </Link>
          <span className="rounded-full border border-wl-border px-3 py-1.5 text-[11px] uppercase tracking-wide text-wl-muted">
            {recommendation.actionState.replaceAll("_", " ")} · not a trade signal
          </span>
        </div>
      </div>
    </section>
  );
}

export function WealthHealthBadge({ health }: { health: WealthHealthScore }) {
  return (
    <div className="wl-card flex min-w-0 items-center gap-3 p-4 sm:gap-4">
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-wl-primary/40 bg-wl-primary/10 sm:h-16 sm:w-16">
        <span className="font-display text-base font-bold text-wl-text sm:text-lg">{health.score}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.14em] text-wl-muted">Wealth Health</p>
        <p className="font-display text-lg font-semibold text-wl-secondary sm:text-xl">{health.tier}</p>
        <p className="text-xs text-wl-muted">Updated {formatRelative(health.lastCalculated)}</p>
      </div>
    </div>
  );
}
