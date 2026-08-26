"use client";

import { GoalCard } from "@/components/financial/Cards";
import { EmptyState, MetricCard, PageHeader, StatusPill } from "@/components/ui/primitives";
import { apiGet } from "@/lib/api/client";
import type { EntitySnapshot } from "@/lib/api/types";
import { cn, formatDate, formatKes } from "@/lib/format";
import { Users } from "lucide-react";
import { useEffect, useState } from "react";

export default function ChamaPage() {
  const [data, setData] = useState<EntitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiGet<EntitySnapshot>("/entities/by-type/CHAMA/snapshot")
      .then((snap) => {
        if (!cancelled) setData(snap);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load chama");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Chama / Community" subtitle="Group goals, contributions, and shared milestones." />
        <div className="cf-card p-8 text-center text-sm text-cf-muted">Loading chama…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Chama / Community" subtitle="Group goals, contributions, and shared milestones." />
        <EmptyState
          title="No chama linked to this account yet"
          body={
            error ??
            "The platform models CHAMA alongside Personal and Business. Once you join or create a group, its pooled balances and goals appear here."
          }
        />
      </div>
    );
  }

  const contributions = data.transactions.filter((t) => t.type === "inflow");
  const disbursements = data.transactions.filter((t) => t.type === "outflow");
  const totalContributed = contributions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={data.entity.name}
        subtitle={data.entity.description ?? "Group savings, contributions, and shared milestones."}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Pooled net worth" value={data.netWorth} />
        <MetricCard label="Liquid pool" value={data.liquid} />
        <MetricCard label="Contributions in period" value={totalContributed} />
        <div className="cf-card p-5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-cf-muted">Members</p>
          <p className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold">
            <Users className="h-5 w-5 text-cf-primary" />
            {data.members.length}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Group goals</h2>
        {data.goals.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {data.goals.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-cf-muted">No group goals set yet.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="cf-card space-y-3 p-5">
          <h2 className="font-display text-lg font-semibold">Members &amp; roles</h2>
          {data.members.length ? (
            <ul className="divide-y divide-wl-border/70">
              {data.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm text-cf-text">{m.name ?? m.userId}</p>
                    <p className="text-xs text-cf-muted">Joined {formatDate(m.joinedAt)}</p>
                  </div>
                  <span className="rounded-full bg-cf-primary/10 px-3 py-1 text-xs font-semibold capitalize text-cf-primary">
                    {m.role}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-cf-muted">No members recorded.</p>
          )}
        </section>

        <section className="cf-card space-y-3 p-5">
          <h2 className="font-display text-lg font-semibold">Pooled accounts</h2>
          <ul className="divide-y divide-wl-border/70">
            {data.accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm text-cf-text">{a.name}</p>
                  <p className="text-xs text-cf-muted">{a.institution}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums text-cf-text">{formatKes(a.balance)}</p>
                  <StatusPill status={a.connectionStatus} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="cf-card space-y-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Contribution &amp; lending ledger</h2>
          <p className="text-xs text-cf-muted">
            {contributions.length} in · {disbursements.length} out
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-cf-border text-[11px] uppercase tracking-wide text-cf-muted">
              <tr>
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Description</th>
                <th className="py-2 pr-4 font-medium">Category</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t) => (
                <tr key={t.id} className="border-b border-cf-border/60">
                  <td className="whitespace-nowrap py-2.5 pr-4 text-cf-muted">{formatDate(t.date)}</td>
                  <td className="py-2.5 pr-4 text-cf-text">{t.description}</td>
                  <td className="py-2.5 pr-4 text-cf-muted">{t.category}</td>
                  <td
                    className={cn(
                      "whitespace-nowrap py-2.5 text-right font-medium tabular-nums",
                      t.type === "inflow" ? "text-cf-success" : "text-cf-text",
                    )}
                  >
                    {t.type === "inflow" ? "+" : "−"}
                    {formatKes(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-cf-muted">
          Group wealth loops carry no MLM mechanics — contributions and lending are recorded, not
          incentivised by recruitment.
        </p>
      </section>
    </div>
  );
}
