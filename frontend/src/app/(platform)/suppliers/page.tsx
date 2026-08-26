"use client";

import { MetricCard, PageHeader } from "@/components/ui/primitives";
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  paySupplier,
} from "@/lib/api/business";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import { cn, formatKes } from "@/lib/format";
import type { BnplAgreement, Supplier } from "@/lib/types";
import { Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const field =
  "w-full rounded-xl border border-cf-border bg-cf-surface-2 px-3 py-2.5 text-sm text-cf-text outline-none focus:border-cf-primary/50";

type SupplierRow = Supplier & { agreements: BnplAgreement[] };

function trustTone(score: number) {
  if (score >= 80) return "bg-cf-success/15 text-cf-success";
  if (score >= 55) return "bg-cf-warning/15 text-cf-warning";
  return "bg-cf-danger/15 text-cf-danger";
}

function PayPanel({
  supplier,
  onDone,
}: {
  supplier: SupplierRow;
  onDone: () => void;
}) {
  const { entityId } = useEntity();
  const data = useEntityData();
  const active = supplier.agreements.find((a) => a.status === "active");

  const [accountId, setAccountId] = useState(data.accounts[0]?.id ?? "");
  const [amount, setAmount] = useState(active ? String(Math.min(15000, active.balance)) : "1000");
  const [channel, setChannel] = useState<"paybill" | "mpesa-till">("paybill");
  const [accountNumber, setAccountNumber] = useState(supplier.paybillOrTill ?? "");
  const [drawBnpl, setDrawBnpl] = useState(Boolean(active));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await paySupplier(entityId, supplier.id, {
        accountId,
        amount: Number(amount),
        channel,
        accountNumber,
        ...(drawBnpl && active ? { bnplAgreementId: active.id } : {}),
      });
      setDone(`Paid via LOOP. Reference ${res.loop.txnReference.slice(0, 13)}…`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="cf-card mt-2 space-y-3 p-5">
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
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={field}
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">LOOP product</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as "paybill" | "mpesa-till")}
            className={field}
          >
            <option value="paybill">Pay to Paybill</option>
            <option value="mpesa-till">Pay to M-Pesa Till</option>
          </select>
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">
            Account number
          </span>
          <input
            required
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className={field}
          />
        </label>
      </div>

      {active && (
        <label className="flex items-center gap-2 text-sm text-cf-muted">
          <input
            type="checkbox"
            checked={drawBnpl}
            onChange={(e) => setDrawBnpl(e.target.checked)}
            className="rounded border-cf-border"
          />
          Draw this down against the BNPL agreement ({formatKes(active.balance)} left)
        </label>
      )}

      {error && <p className="text-sm text-cf-danger">{error}</p>}
      {done && <p className="text-sm text-cf-success">{done}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Paying…" : "Pay supplier"}
      </button>
    </form>
  );
}

export default function SuppliersPage() {
  const { entityId, entityType, setEntityType, refresh } = useEntity();
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [till, setTill] = useState("");

  useEffect(() => {
    if (entityType !== "BUSINESS") setEntityType("BUSINESS");
  }, [entityType, setEntityType]);

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await listSuppliers(entityId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load suppliers");
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const owed = rows.reduce(
    (sum, s) => sum + s.agreements.filter((a) => a.status === "active").reduce((t, a) => t + a.balance, 0),
    0,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Suppliers & payables"
        subtitle="Who you buy from, what you still owe them, and paying it over LOOP."
      />

      <MetricCard label="Outstanding on BNPL agreements" value={owed} tone={owed > 0 ? "danger" : undefined} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Your suppliers</h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold",
            adding ? "border-cf-border text-cf-muted" : "border-cf-primary/40 text-cf-text hover:bg-cf-primary/10",
          )}
        >
          {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {adding ? "Cancel" : "Add supplier"}
        </button>
      </div>

      {error && <p className="text-sm text-cf-danger">{error}</p>}

      {adding && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await createSupplier(entityId, { name, paybillOrTill: till || null });
            setName("");
            setTill("");
            setAdding(false);
            void load();
          }}
          className="cf-card grid gap-3 p-5 sm:grid-cols-2"
        >
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Name</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">
              Paybill or till
            </span>
            <input value={till} onChange={(e) => setTill(e.target.value)} placeholder="888880" className={field} />
          </label>
          <button
            type="submit"
            className="rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep px-5 py-2.5 text-sm font-semibold text-white sm:col-span-2 sm:justify-self-start"
          >
            Add supplier
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-cf-muted">Loading…</p>}

      {!loading && rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-cf-border px-4 py-10 text-center text-sm text-cf-muted">
          No suppliers yet. Add one to pay them straight from here.
        </p>
      )}

      <div className="space-y-3">
        {rows.map((s) => {
          const history = s.paymentHistory ?? {};
          const active = s.agreements.filter((a) => a.status === "active");
          return (
            <div key={s.id}>
              <article className="cf-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-semibold">{s.name}</h3>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          trustTone(s.trustScore),
                        )}
                      >
                        trust {s.trustScore}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-cf-muted">
                      {s.paybillOrTill ? `Paybill/till ${s.paybillOrTill}` : "No till saved"}
                      {history.onTimePayments != null &&
                        ` · ${history.onTimePayments} on time, ${history.latePayments ?? 0} late`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPaying(paying === s.id ? null : s.id)}
                      className="rounded-full border border-cf-primary/40 px-4 py-1.5 text-xs font-semibold text-cf-text hover:bg-cf-primary/10"
                    >
                      {paying === s.id ? "Close" : "Pay"}
                    </button>
                    <button
                      type="button"
                      aria-label="Delete supplier"
                      onClick={async () => {
                        await deleteSupplier(entityId, s.id);
                        void load();
                      }}
                      className="rounded-lg border border-cf-border p-1.5 text-cf-muted hover:text-cf-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {active.length > 0 && (
                  <div className="mt-4 space-y-2 rounded-xl border border-cf-border bg-[var(--cf-inset)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cf-muted">
                      Buy-now-pay-later
                    </p>
                    {active.map((a) => (
                      <div key={a.id}>
                        <p className="text-sm text-cf-text">
                          {formatKes(a.balance)} outstanding of {formatKes(a.principal)}
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {a.installments.map((inst, idx) => (
                            <li key={idx} className="flex justify-between text-xs text-cf-muted">
                              <span>{inst.dueDate}</span>
                              <span className="tabular-nums">
                                {formatKes(inst.amount)} · {inst.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              {paying === s.id && (
                <PayPanel
                  supplier={s}
                  onDone={() => {
                    void load();
                    refresh();
                    setPaying(null);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
