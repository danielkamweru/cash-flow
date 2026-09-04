"use client";

import { RecordManager, type FieldSpec } from "@/components/financial/RecordManager";
import { MetricCard, PageHeader, StatusPill } from "@/components/ui/primitives";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { liabilitiesApi, payDebt } from "@/lib/api/resources";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import { formatKes } from "@/lib/format";
import { friendlyError } from "@/lib/friendlyError";
import { useState } from "react";
import type { Liability } from "@/lib/types";

const FIELDS: FieldSpec[] = [
  { key: "name", label: "Name", placeholder: "Phone financing" },
  { key: "lender", label: "Lender", placeholder: "Equity Bank" },
  { key: "balance", label: "Outstanding balance (KES)", kind: "number", placeholder: "28000" },
  { key: "monthlyPayment", label: "Monthly payment (KES)", kind: "number", placeholder: "4500" },
  { key: "interestRate", label: "Interest rate (%)", kind: "number", required: false, step: "0.1" },
  {
    key: "dueDay",
    label: "Day of month due",
    kind: "number",
    required: false,
    step: "1",
    hint: "1–31, if it has a fixed due date.",
  },
];

/** Pay down a liability from an account. */
function RepayPanel({ liability, onDone }: { liability: Liability; onDone: () => void }) {
  const { entityId } = useEntity();
  const data = useEntityData();
  const toast = useToast();
  const [accountId, setAccountId] = useState(data.accounts[0]?.id ?? "");
  const [amount, setAmount] = useState(String(Math.min(liability.monthlyPayment, liability.balance)));
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field =
    "w-full rounded-xl border border-cf-border bg-cf-surface-2 px-3 py-3 text-sm text-cf-text outline-none focus:border-cf-primary/50 sm:py-2.5";

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
      const res = await payDebt(entityId, {
        accountId,
        liabilityId: liability.id,
        amount: Number(amount),
      });
      toast(`Payment recorded. ${liability.name} balance is now ${formatKes(res.liability.balance)}.`, "success");
      onDone();
    } catch (err) {
      const msg = friendlyError(err, "Payment failed. Please try again.");
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
        title="Confirm payment"
        confirmLabel="Make payment"
        onConfirm={() => void execute()}
        onCancel={() => setConfirming(false)}
      >
        <p>
          Pay <strong className="text-cf-text">{formatKes(Number(amount))}</strong> toward{" "}
          <strong className="text-cf-text">{liability.name}</strong> from{" "}
          <strong className="text-cf-text">{account?.name ?? "selected account"}</strong>?
        </p>
      </ConfirmModal>

      <form onSubmit={handleSubmit} className="cf-card mt-2 space-y-3 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Pay from</span>
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
              inputMode="decimal"
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
          {busy ? "Paying…" : "Make payment"}
        </button>
      </form>
    </>
  );
}

export default function LiabilitiesPage() {
  const data = useEntityData();
  const { refresh } = useEntity();
  const [repaying, setRepaying] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Liabilities"
        subtitle="Loans and credit obligations that reduce net worth and constrain surplus."
      />
      <MetricCard label="Total liabilities" value={data.liabilities} tone="danger" />

      <RecordManager
        title="What you owe"
        addLabel="Add liability"
        fields={FIELDS}
        items={data.liabilitiesList}
        api={liabilitiesApi}
        emptyMessage="Nothing owed. Add a loan or credit facility to track it here."
        toValues={(l) => ({
          name: l.name,
          lender: l.lender,
          balance: l.balance,
          monthlyPayment: l.monthlyPayment,
          interestRate: l.interestRate ?? "",
          dueDay: l.dueDay ?? "",
        })}
        toPayload={(v) => ({
          name: String(v.name),
          lender: String(v.lender),
          balance: Number(v.balance),
          monthlyPayment: Number(v.monthlyPayment),
          interestRate: v.interestRate === "" ? null : Number(v.interestRate),
          dueDay: v.dueDay === "" ? null : Number(v.dueDay),
        })}
        renderItem={(l, controls) => (
          <div>
            <article className="cf-card flex items-start justify-between gap-3 p-5">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg font-semibold">{l.name}</h3>
                  <StatusPill status={l.provenance} />
                </div>
                <p className="text-xs text-cf-muted">{l.lender}</p>
                <p className="mt-3 font-display text-2xl font-semibold tabular-nums">
                  {formatKes(l.balance)}
                </p>
                <p className="mt-2 text-xs text-cf-muted">
                  Monthly service {formatKes(l.monthlyPayment)}
                  {l.interestRate != null ? ` · ${l.interestRate}%` : ""}
                </p>
                {l.balance > 0 && (
                  <button
                    type="button"
                    onClick={() => setRepaying(repaying === l.id ? null : l.id)}
                    className="mt-3 rounded-full border border-cf-primary/40 px-4 py-1.5 text-xs font-semibold text-cf-text hover:bg-cf-primary/10"
                  >
                    {repaying === l.id ? "Close" : "Make a payment"}
                  </button>
                )}
              </div>
              {controls}
            </article>
            {repaying === l.id && (
              <RepayPanel
                liability={l}
                onDone={() => {
                  refresh();
                  setRepaying(null);
                }}
              />
            )}
          </div>
        )}
      />
    </div>
  );
}
