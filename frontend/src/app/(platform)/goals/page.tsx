"use client";

import { RecordManager, type FieldSpec } from "@/components/financial/RecordManager";
import { PageHeader } from "@/components/ui/primitives";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { fundGoal, goalsApi } from "@/lib/api/resources";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import { formatKes } from "@/lib/format";
import { friendlyError } from "@/lib/friendlyError";
import type { Goal } from "@/lib/types";
import { useState } from "react";

const FIELDS: FieldSpec[] = [
  { key: "name", label: "Goal", placeholder: "Emergency Fund" },
  {
    key: "category",
    label: "Category",
    kind: "select",
    options: [
      { value: "emergency", label: "Emergency fund" },
      { value: "education", label: "Education" },
      { value: "purchase", label: "Purchase" },
      { value: "property", label: "Property" },
      { value: "business", label: "Business" },
      { value: "retirement", label: "Retirement" },
      { value: "investment", label: "Investment" },
      { value: "other", label: "Other" },
    ],
  },
  { key: "target", label: "Target (KES)", kind: "number", placeholder: "300000" },
  { key: "current", label: "Saved so far (KES)", kind: "number", placeholder: "0" },
  { key: "deadline", label: "Deadline", kind: "date" },
  { key: "monthlyContribution", label: "Monthly contribution (KES)", kind: "number", placeholder: "20000" },
  {
    key: "priority",
    label: "Priority",
    kind: "number",
    step: "1",
    hint: "1 is highest — it leads the Advisor's ordering.",
  },
];

function FundPanel({ goal, onDone }: { goal: Goal; onDone: () => void }) {
  const { entityId } = useEntity();
  const data = useEntityData();
  const toast = useToast();
  const [accountId, setAccountId] = useState(data.accounts[0]?.id ?? "");
  const [amount, setAmount] = useState(String(goal.monthlyContribution || 1000));
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field =
    "w-full rounded-xl border border-cf-border bg-cf-surface-2 px-3 py-2.5 text-sm text-cf-text outline-none focus:border-cf-primary/50";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accountId) { setError("Please select an account."); return; }
    const value = Number(amount);
    if (!amount || isNaN(value) || value <= 0) { setError("Please enter a valid amount greater than zero."); return; }
    setConfirming(true);
  }

  async function execute() {
    setConfirming(false);
    setBusy(true);
    setError(null);
    try {
      const res = await fundGoal(entityId, { accountId, goalId: goal.id, amount: Number(amount) });
      toast(`Added to ${goal.name}. Now at ${formatKes(res.goal.current)}.`, "success");
      onDone();
    } catch (err) {
      const msg = friendlyError(err, "Could not fund the goal. Please try again.");
      setError(msg);
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  const account = data.accounts.find((a) => a.id === accountId);

  return (
    <>
      <ConfirmModal
        open={confirming}
        title="Confirm transfer"
        confirmLabel="Move funds"
        onConfirm={() => void execute()}
        onCancel={() => setConfirming(false)}
      >
        <p>
          Move <strong className="text-cf-text">{formatKes(Number(amount))}</strong> from{" "}
          <strong className="text-cf-text">{account?.name ?? "selected account"}</strong> into{" "}
          <strong className="text-cf-text">{goal.name}</strong>?
        </p>
      </ConfirmModal>

      <form onSubmit={handleSubmit} className="cf-card mt-2 space-y-3 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">From</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={field}>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {formatKes(a.balance)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Amount (KES)</span>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={field}
            />
          </label>
        </div>
        {error && <p className="text-sm text-cf-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Moving…" : "Add to goal"}
        </button>
      </form>
    </>
  );
}

export default function GoalsPage() {
  const data = useEntityData();
  const { refresh } = useEntity();
  const [funding, setFunding] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Goals"
        subtitle="Give surplus a destination — emergency, education, property, business growth."
      />

      <RecordManager
        title="Your goals"
        addLabel="Add goal"
        fields={FIELDS}
        items={data.goals}
        api={goalsApi}
        emptyMessage="No goals yet. Add one and the Advisor will work out what it needs each month."
        toValues={(g) => ({
          name: g.name,
          category: g.category,
          target: g.target,
          current: g.current,
          deadline: g.deadline,
          monthlyContribution: g.monthlyContribution,
          priority: g.priority,
        })}
        toPayload={(v) => ({
          name: String(v.name),
          category: String(v.category),
          target: Number(v.target),
          current: Number(v.current),
          deadline: new Date(String(v.deadline)).toISOString(),
          monthlyContribution: Number(v.monthlyContribution),
          priority: Number(v.priority),
        })}
        renderItem={(g, controls) => {
          const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
          return (
            <div>
              <article className="cf-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold">{g.name}</h3>
                    <p className="text-xs capitalize text-cf-muted">
                      {g.category} · due {String(g.deadline).slice(0, 10)}
                    </p>
                  </div>
                  {controls}
                </div>

                <p className="mt-3 font-display text-2xl font-semibold tabular-nums">
                  {formatKes(g.current)}
                  <span className="text-sm font-normal text-cf-muted"> of {formatKes(g.target)}</span>
                </p>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--cf-inset)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-cf-muted">
                  {pct.toFixed(0)}% · {formatKes(g.monthlyContribution)} a month
                </p>

                {g.current < g.target && (
                  <button
                    type="button"
                    onClick={() => setFunding(funding === g.id ? null : g.id)}
                    className="mt-3 rounded-full border border-cf-primary/40 px-4 py-1.5 text-xs font-semibold text-cf-text hover:bg-cf-primary/10"
                  >
                    {funding === g.id ? "Close" : "Add money"}
                  </button>
                )}
              </article>
              {funding === g.id && (
                <FundPanel
                  goal={g}
                  onDone={() => {
                    refresh();
                    setFunding(null);
                  }}
                />
              )}
            </div>
          );
        }}
      />
    </div>
  );
}
