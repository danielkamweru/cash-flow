"use client";

import { MetricCard, PageHeader } from "@/components/ui/primitives";
import {
  collectInvoice,
  createInvoice,
  deleteInvoice,
  fetchAgeing,
  listInvoices,
  recordInvoicePayment,
  type Ageing,
  type Invoice,
} from "@/lib/api/business";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import { cn, formatKes } from "@/lib/format";
import { Plus, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const field =
  "w-full rounded-xl border border-cf-border bg-cf-surface-2 px-3 py-2.5 text-sm text-cf-text outline-none focus:border-cf-primary/50";

const STATUS_TONE: Record<string, string> = {
  paid: "bg-cf-success/15 text-cf-success",
  part_paid: "bg-cf-warning/15 text-cf-warning",
  overdue: "bg-cf-danger/15 text-cf-danger",
  sent: "bg-cf-primary/10 text-cf-primary",
  draft: "bg-cf-surface-2 text-cf-muted",
  cancelled: "bg-cf-surface-2 text-cf-muted",
};

const BUCKETS: { key: keyof Ageing["buckets"]; label: string }[] = [
  { key: "current", label: "Not yet due" },
  { key: "d1_30", label: "1–30 days" },
  { key: "d31_60", label: "31–60 days" },
  { key: "d61_90", label: "61–90 days" },
  { key: "d90_plus", label: "90+ days" },
];

function CollectPanel({ invoice, onDone }: { invoice: Invoice; onDone: () => void }) {
  const { entityId } = useEntity();
  const data = useEntityData();
  const [accountId, setAccountId] = useState(
    data.accounts.find((a) => a.provider === "mpesa")?.id ?? data.accounts[0]?.id ?? "",
  );
  const [channel, setChannel] = useState<"mpesa" | "loop">("mpesa");
  const [phone, setPhone] = useState(invoice.customerPhone ?? "");
  const [amount, setAmount] = useState(String(invoice.outstanding));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await collectInvoice(entityId, invoice.id, {
        accountId,
        channel,
        phone,
        amount: Number(amount),
      });
      setDone(
        `Prompt sent to ${phone}. Reference ${res.loop.txnReference.slice(0, 13)}… — the invoice settles when they pay.`,
      );
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="cf-card mt-2 space-y-3 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Collect into</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={field}>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Prompt type</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as "mpesa" | "loop")}
            className={field}
          >
            <option value="mpesa">M-Pesa STK push</option>
            <option value="loop">LOOP request-to-pay</option>
          </select>
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Customer phone</span>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0704540384"
            className={field}
          />
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
      {done && <p className="text-sm text-cf-success">{done}</p>}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        <Send className="h-3.5 w-3.5" />
        {busy ? "Sending…" : "Request payment"}
      </button>
    </form>
  );
}

function RecordPanel({ invoice, onDone }: { invoice: Invoice; onDone: () => void }) {
  const { entityId } = useEntity();
  const [amount, setAmount] = useState(String(invoice.outstanding));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await recordInvoicePayment(entityId, invoice.id, Number(amount));
      setDone(`${formatKes(updated.amountPaid)} paid of ${formatKes(updated.amount)} — marked ${updated.status}.`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="cf-card mt-2 space-y-3 p-5">
      <label className="block space-y-1.5 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">
          Amount received off-platform (KES)
        </span>
        <input
          type="number"
          step="0.01"
          min="0.01"
          max={invoice.outstanding}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={field}
        />
      </label>
      {error && <p className="text-sm text-cf-danger">{error}</p>}
      {done && <p className="text-sm text-cf-success">{done}</p>}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
}

export default function ReceivablesPage() {
  const { entityId, entityType, setEntityType, refresh } = useEntity();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ageing, setAgeing] = useState<Ageing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [collecting, setCollecting] = useState<string | null>(null);
  const [recording, setRecording] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (entityType !== "BUSINESS") setEntityType("BUSINESS");
  }, [entityType, setEntityType]);

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError(null);
    try {
      const [inv, age] = await Promise.all([listInvoices(entityId), fetchAgeing(entityId)]);
      setInvoices(inv);
      setAgeing(age);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load invoices");
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Receivables"
        subtitle="Invoices owed to you, and collecting them with an STK or LOOP prompt."
      />

      <MetricCard
        label="Owed to you"
        value={ageing?.totalOutstanding ?? 0}
        hint={`${ageing?.invoiceCount ?? 0} unpaid invoices`}
      />

      {ageing && ageing.totalOutstanding > 0 && (
        <section className="cf-card p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Ageing</h2>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {BUCKETS.map((b) => {
              const value = ageing.buckets[b.key];
              return (
                <div key={b.key} className="rounded-xl border border-cf-border bg-[var(--cf-inset)] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-cf-muted">{b.label}</p>
                  <p
                    className={cn(
                      "font-display text-lg font-semibold tabular-nums",
                      b.key === "d90_plus" && value > 0 && "text-cf-danger",
                    )}
                  >
                    {formatKes(value)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Invoices</h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold",
            adding ? "border-cf-border text-cf-muted" : "border-cf-primary/40 text-cf-text hover:bg-cf-primary/10",
          )}
        >
          {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {adding ? "Cancel" : "New invoice"}
        </button>
      </div>

      {error && <p className="text-sm text-cf-danger">{error}</p>}

      {adding && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await createInvoice(entityId, {
              customerName,
              customerPhone: customerPhone || null,
              amount: Number(amount),
              ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
            });
            setCustomerName("");
            setCustomerPhone("");
            setAmount("");
            setDueDate("");
            setAdding(false);
            void load();
          }}
          className="cf-card grid gap-3 p-5 sm:grid-cols-2"
        >
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Customer</span>
            <input required value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={field} />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Phone</span>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="0704540384"
              className={field}
            />
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
            <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Due date</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
          </label>
          <button
            type="submit"
            className="rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep px-5 py-2.5 text-sm font-semibold text-white sm:col-span-2 sm:justify-self-start"
          >
            Create invoice
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-cf-muted">Loading…</p>}

      {!loading && invoices.length === 0 && (
        <p className="rounded-xl border border-dashed border-cf-border px-4 py-10 text-center text-sm text-cf-muted">
          No invoices yet. Raise one and request payment without leaving the page.
        </p>
      )}

      <div className="space-y-3">
        {invoices.map((inv) => (
          <div key={inv.id}>
            <article className="cf-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold">{inv.number}</h3>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        STATUS_TONE[inv.status] ?? STATUS_TONE.draft,
                      )}
                    >
                      {inv.status.replace("_", " ")}
                      {inv.daysOverdue > 0 ? ` · ${inv.daysOverdue}d` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-cf-muted">
                    {inv.customerName}
                    {inv.customerPhone ? ` · ${inv.customerPhone}` : ""}
                    {inv.dueDate ? ` · due ${inv.dueDate.slice(0, 10)}` : ""}
                  </p>
                  <p className="mt-3 font-display text-2xl font-semibold tabular-nums">
                    {formatKes(inv.outstanding)}
                    {inv.amountPaid > 0 && (
                      <span className="text-sm font-normal text-cf-muted">
                        {" "}
                        outstanding of {formatKes(inv.amount)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {inv.outstanding > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRecording(null);
                          setCollecting(collecting === inv.id ? null : inv.id);
                        }}
                        className="rounded-full border border-cf-primary/40 px-4 py-1.5 text-xs font-semibold text-cf-text hover:bg-cf-primary/10"
                      >
                        {collecting === inv.id ? "Close" : "Request payment"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCollecting(null);
                          setRecording(recording === inv.id ? null : inv.id);
                        }}
                        className="rounded-full border border-cf-border px-4 py-1.5 text-xs font-semibold text-cf-muted hover:bg-[var(--cf-inset)] hover:text-cf-text"
                      >
                        {recording === inv.id ? "Close" : "Record payment"}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    aria-label="Delete invoice"
                    onClick={async () => {
                      await deleteInvoice(entityId, inv.id);
                      void load();
                    }}
                    className="rounded-lg border border-cf-border p-1.5 text-cf-muted hover:text-cf-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>

            {collecting === inv.id && (
              <CollectPanel
                invoice={inv}
                onDone={() => {
                  void load();
                  refresh();
                  setCollecting(null);
                }}
              />
            )}

            {recording === inv.id && (
              <RecordPanel
                invoice={inv}
                onDone={() => {
                  void load();
                  refresh();
                  setRecording(null);
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
