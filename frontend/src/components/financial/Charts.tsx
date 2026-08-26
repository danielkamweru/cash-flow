"use client";

import { formatKes } from "@/lib/format";

export function CashFlowChart({
  series,
}: {
  series: { month: string; inflow: number; outflow: number }[];
}) {
  const max = Math.max(...series.flatMap((s) => [s.inflow, s.outflow]), 1);

  return (
    <div className="wl-card p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-wl-text">Cash flow</h3>
          <p className="text-xs text-wl-muted">Demo monthly pattern · not a live bank feed</p>
        </div>
        <div className="flex shrink-0 gap-3 text-[11px] text-wl-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-wl-success" /> Inflow
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-wl-primary" /> Outflow
          </span>
        </div>
      </div>
      <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
        <div className="flex h-44 min-w-[280px] items-end gap-2 sm:min-w-0 sm:gap-3">
          {series.map((s, i) => (
            <div key={s.month} className="flex min-w-[2.25rem] flex-1 flex-col items-center gap-2">
              <div className="flex h-36 w-full items-end justify-center gap-0.5 sm:gap-1">
                <div
                  className="w-[42%] rounded-t-md bg-wl-success/80 transition-all duration-700"
                  style={{ height: `${(s.inflow / max) * 100}%`, animationDelay: `${i * 40}ms` }}
                  title={`In ${formatKes(s.inflow)}`}
                />
                <div
                  className="w-[42%] rounded-t-md bg-wl-primary/80 transition-all duration-700"
                  style={{ height: `${(s.outflow / max) * 100}%` }}
                  title={`Out ${formatKes(s.outflow)}`}
                />
              </div>
              <span className="text-[10px] text-wl-muted">{s.month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NetWorthHero({
  netWorth,
  liquid,
  investments,
  liabilities,
  monthlyFlow,
}: {
  netWorth: number;
  liquid: number;
  investments: number;
  liabilities: number;
  monthlyFlow: number;
}) {
  return (
    <section className="wl-card relative overflow-hidden p-4 sm:p-5 md:p-7 animate-fade-up">
      <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-wl-primary/15 to-transparent" />
      <div className="relative min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-wl-muted">
          Where am I?
        </p>
        <h2 className="mt-2 break-words font-display text-3xl font-semibold tracking-tight text-wl-text sm:text-4xl md:text-5xl">
          {formatKes(netWorth)}
        </h2>
        <p className="mt-1 text-sm text-wl-muted">Total net worth · assets − liabilities</p>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
          {[
            { label: "Liquid cash", value: liquid },
            { label: "Investments", value: investments },
            { label: "Liabilities", value: -liabilities },
            { label: "Monthly cash flow", value: monthlyFlow, signed: true },
          ].map((m) => (
            <div
              key={m.label}
              className="min-w-0 rounded-xl border border-wl-border bg-[var(--wealth-inset)] px-2.5 py-3 sm:px-3"
            >
              <p className="text-[10px] uppercase tracking-wide text-wl-muted">{m.label}</p>
              <p className="mt-1 break-words font-display text-base font-semibold text-wl-text sm:text-lg">
                {formatKes(m.value, { signed: m.signed })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
