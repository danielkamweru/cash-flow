"use client";

import { formatKes, progressRatio } from "@/lib/format";
import type { Goal, Recommendation } from "@/lib/types";
import { ProgressBar, StatusPill } from "@/components/ui/primitives";
import Link from "next/link";

export function GoalCard({ goal }: { goal: Goal }) {
  const remaining = Math.max(0, goal.target - goal.current);
  const ratio = progressRatio(goal.current, goal.target);

  return (
    <article className="wl-card flex min-w-0 flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-wl-text sm:text-lg">{goal.name}</h3>
          <p className="text-xs capitalize text-wl-muted">{goal.category.replaceAll("_", " ")}</p>
        </div>
        <StatusPill status="demo" />
      </div>
      <p className="break-words font-display text-lg font-semibold text-wl-text sm:text-xl">
        {formatKes(goal.current)}{" "}
        <span className="text-sm font-normal text-wl-muted">/ {formatKes(goal.target)}</span>
      </p>
      <ProgressBar value={ratio} className="mt-3" />
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-wl-muted">
        <div className="min-w-0">
          <p className="uppercase tracking-wide">Remaining</p>
          <p className="mt-0.5 break-words text-sm text-wl-text">{formatKes(remaining)}</p>
        </div>
        <div className="min-w-0">
          <p className="uppercase tracking-wide">Monthly</p>
          <p className="mt-0.5 break-words text-sm text-wl-text">{formatKes(goal.monthlyContribution)}</p>
        </div>
        <div className="col-span-2 min-w-0">
          <p className="uppercase tracking-wide">Deadline</p>
          <p className="mt-0.5 text-sm text-wl-text">{goal.deadline}</p>
        </div>
      </div>
    </article>
  );
}

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <article className="wl-card flex flex-col p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <StatusPill status={rec.actionState} />
        <span className="text-[10px] uppercase tracking-wide text-wl-muted">Risk · {rec.risk}</span>
      </div>
      <h3 className="font-display text-lg font-semibold text-wl-text">{rec.title}</h3>
      <p className="mt-2 text-sm text-wl-muted">{rec.summary}</p>
      <div className="mt-4 rounded-xl bg-wl-surface-2/80 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-wl-secondary">
          Why this appears
        </p>
        <ul className="mt-2 space-y-1.5 text-xs text-wl-text-secondary">
          {rec.why.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-wl-muted">Liquidity</dt>
          <dd className="text-wl-text">{rec.liquidity}</dd>
        </div>
        <div>
          <dt className="text-wl-muted">Horizon</dt>
          <dd className="text-wl-text">{rec.timeHorizon}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] text-wl-muted">
        Assumptions: {rec.assumptions[0]} Not a guarantee of returns.
      </p>
      <Link
        href="/intelligence"
        className="mt-4 inline-flex justify-center rounded-full border border-wl-border px-4 py-2 text-sm font-medium text-wl-text hover:border-wl-primary/40"
      >
        {rec.actionLabel}
      </Link>
    </article>
  );
}
