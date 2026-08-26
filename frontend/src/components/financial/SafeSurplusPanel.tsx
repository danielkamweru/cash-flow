"use client";

import { formatKes, formatRelative } from "@/lib/format";
import type { SurplusBreakdown } from "@/lib/types";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { useState } from "react";

export function SafeSurplusPanel({ surplus }: { surplus: SurplusBreakdown }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="wl-card overflow-hidden animate-fade-up-delay-1">
      <div className="border-b border-wl-border bg-gradient-to-r from-wl-primary/20 via-transparent to-wl-secondary/10 px-4 py-4 sm:px-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-wl-secondary">
              Safe to use
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-wl-text sm:text-xl">
              Surplus after obligations & buffer
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-wl-border px-3 py-1.5 text-xs text-wl-muted hover:text-wl-text"
          >
            Why this amount
            <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:gap-4 sm:p-5 md:grid-cols-2 md:p-6">
        <div className="min-w-0 rounded-2xl border border-wl-border bg-wl-surface-2/60 p-4">
          <p className="text-xs text-wl-muted">Safe-to-Spend</p>
          <p className="mt-1 break-words font-display text-2xl font-semibold text-wl-text sm:text-3xl">
            {formatKes(surplus.safeToSpend)}
          </p>
          <p className="mt-2 text-xs text-wl-muted">
            Discretionary slice of surplus for near-term flexibility.
          </p>
        </div>
        <div className="min-w-0 rounded-2xl border border-wl-primary/30 bg-wl-primary/10 p-4">
          <p className="text-xs text-wl-secondary">Safe-to-Invest</p>
          <p className="mt-1 break-words font-display text-2xl font-semibold text-wl-text sm:text-3xl">
            {formatKes(surplus.safeToInvest)}
          </p>
          <p className="mt-2 text-xs text-wl-muted">
            Remainder available for goals or low-risk instruments — with your approval.
          </p>
        </div>
      </div>

      {open && (
        <div className="border-t border-wl-border px-4 pb-4 sm:px-5 sm:pb-5 md:px-6 md:pb-6">
          <div className="wl-card-light mt-4 overflow-x-auto p-4 md:p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--wealth-contrast-text)]">
              <ShieldCheck className="h-4 w-4 shrink-0 text-wl-primary" />
              Calculated from
            </div>
            <ul className="space-y-2 font-mono text-xs text-[var(--wealth-contrast-text)] sm:text-sm">
              {surplus.components.map((c) => (
                <li
                  key={c.label}
                  className="flex items-start justify-between gap-3 border-b border-current/10 pb-2"
                >
                  <span className="min-w-0 break-words">
                    {c.sign === "-" ? "−" : "+"} {c.label}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatKes(c.amount)}</span>
                </li>
              ))}
              <li className="flex items-start justify-between gap-3 pt-1 font-semibold">
                <span>Safe surplus</span>
                <span className="shrink-0 tabular-nums">
                  {formatKes(surplus.safeToSpend + surplus.safeToInvest)}
                </span>
              </li>
            </ul>
            <p className="mt-3 text-xs opacity-70">
              Formula: {surplus.formula}. Last calculated {formatRelative(surplus.lastCalculated)}.
              Values marked demo/manual where integrations are not live.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
