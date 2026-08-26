"use client";

import { PageHeader, StatusPill } from "@/components/ui/primitives";
import { apiDownload, apiGet } from "@/lib/api/client";
import { transactionInquiry } from "@/lib/api/loop";
import { useEntityData } from "@/lib/context/EntityContext";
import { cn, formatDate, formatKes } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { Download, FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

/** YYYY-MM-DD in local time — the format the date input and the API both use. */
function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfMonth(): string {
  const now = new Date();
  return toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

const PRESETS: { label: string; range: () => [string, string] }[] = [
  {
    label: "This month",
    range: () => [startOfMonth(), toInputDate(new Date())],
  },
  {
    label: "Last 30 days",
    range: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return [toInputDate(start), toInputDate(end)];
    },
  },
  {
    label: "Last 90 days",
    range: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 90);
      return [toInputDate(start), toInputDate(end)];
    },
  },
  {
    label: "This year",
    range: () => {
      const now = new Date();
      return [toInputDate(new Date(now.getFullYear(), 0, 1)), toInputDate(now)];
    },
  },
];

function statusTone(status?: string): string {
  if (status === "pending") return "text-wl-warning";
  if (status === "failed") return "text-wl-danger";
  return "text-wl-muted";
}

export default function TransactionsPage() {
  const data = useEntityData();
  const entityId = data.entity.id;

  const [start, setStart] = useState(startOfMonth);
  const [end, setEnd] = useState(() => toInputDate(new Date()));
  const [rows, setRows] = useState<Transaction[]>(data.transactions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [checking, setChecking] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    return params.toString();
  }, [start, end]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await apiGet<Transaction[]>(`/entities/${entityId}/transactions?${query}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [entityId, query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onExport(format: "xlsx" | "pdf") {
    setExporting(format);
    setError(null);
    try {
      await apiDownload(
        `/entities/${entityId}/transactions/export?format=${format}&${query}`,
        `transactions.${format}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  /** Ask LOOP whether a pending transaction settled, then refresh the ledger. */
  async function onCheckStatus(reference: string) {
    setChecking(reference);
    setError(null);
    try {
      await transactionInquiry({ txnReference: reference });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status check failed");
    } finally {
      setChecking(null);
    }
  }

  const totals = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const t of rows) {
      if (t.type === "inflow") inflow += t.amount;
      else if (t.type === "outflow") outflow += t.amount;
    }
    return { inflow, outflow, net: inflow - outflow };
  }, [rows]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Transactions"
        subtitle="Inflows and outflows power cash-flow analysis and surplus detection."
      />

      <section className="wl-card space-y-4 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-medium uppercase tracking-wide text-wl-muted">From</span>
            <input
              type="date"
              value={start}
              max={end || undefined}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-xl border border-wl-border bg-wl-surface-2 px-3 py-2 text-sm text-wl-text outline-none focus:border-wl-primary/50"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-medium uppercase tracking-wide text-wl-muted">To</span>
            <input
              type="date"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-xl border border-wl-border bg-wl-surface-2 px-3 py-2 text-sm text-wl-text outline-none focus:border-wl-primary/50"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  const [s, e] = p.range();
                  setStart(s);
                  setEnd(e);
                }}
                className="rounded-full border border-wl-border px-3 py-1.5 text-xs font-medium text-wl-muted transition-colors hover:border-wl-primary/40 hover:text-wl-text"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setStart("");
                setEnd("");
              }}
              className="rounded-full border border-wl-border px-3 py-1.5 text-xs font-medium text-wl-muted transition-colors hover:border-wl-primary/40 hover:text-wl-text"
            >
              All time
            </button>
          </div>

          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => void onExport("xlsx")}
              disabled={exporting !== null}
              className="inline-flex items-center gap-2 rounded-full border border-wl-border px-4 py-2 text-xs font-semibold text-wl-text transition-colors hover:border-wl-primary/40 disabled:opacity-60"
            >
              {exporting === "xlsx" ? (
                <Download className="h-3.5 w-3.5 animate-pulse" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5 text-wl-success" />
              )}
              Excel
            </button>
            <button
              type="button"
              onClick={() => void onExport("pdf")}
              disabled={exporting !== null}
              className="inline-flex items-center gap-2 rounded-full border border-wl-border px-4 py-2 text-xs font-semibold text-wl-text transition-colors hover:border-wl-primary/40 disabled:opacity-60"
            >
              {exporting === "pdf" ? (
                <Download className="h-3.5 w-3.5 animate-pulse" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-wl-danger" />
              )}
              PDF
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["Inflow", totals.inflow, "text-wl-success"],
              ["Outflow", totals.outflow, "text-wl-text"],
              ["Net", totals.net, totals.net >= 0 ? "text-wl-success" : "text-wl-danger"],
            ] as const
          ).map(([label, value, tone]) => (
            <div key={label} className="rounded-xl border border-wl-border bg-[var(--wealth-inset)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-wl-muted">{label}</p>
              <p className={cn("font-display text-lg font-semibold tabular-nums", tone)}>{formatKes(value)}</p>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-wl-danger">{error}</p>}
      </section>

      <div className="wl-card overflow-hidden">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-wl-border bg-wl-surface-2/50 text-[11px] uppercase tracking-wide text-wl-muted">
              <tr>
                <th className="px-3 py-3 font-medium sm:px-4">Date</th>
                <th className="px-3 py-3 font-medium sm:px-4">Description</th>
                <th className="px-3 py-3 font-medium sm:px-4">Category</th>
                <th className="px-3 py-3 font-medium sm:px-4">Status</th>
                <th className="px-3 py-3 text-right font-medium sm:px-4">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 sm:px-4 text-center text-wl-muted">
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 sm:px-4 text-center text-wl-muted">
                    No transactions in this period.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((t) => (
                  <tr key={t.id} className="border-b border-wl-border/70">
                    <td className="whitespace-nowrap px-3 py-3 text-wl-muted sm:px-4">{formatDate(t.date)}</td>
                    <td className="px-3 py-3 sm:px-4">
                      <p className="max-w-[220px] truncate text-wl-text sm:max-w-none sm:whitespace-normal">
                        {t.description}
                      </p>
                      <StatusPill status={t.provenance} />
                    </td>
                    <td className="px-3 py-3 text-wl-muted sm:px-4">{t.category}</td>
                    <td className="px-3 py-3 sm:px-4">
                      <span className={cn("text-xs font-medium capitalize", statusTone(t.status))}>
                        {t.status ?? "completed"}
                      </span>
                      {t.status === "pending" && t.loopTxnReference && (
                        <button
                          type="button"
                          onClick={() => void onCheckStatus(t.loopTxnReference!)}
                          disabled={checking === t.loopTxnReference}
                          className="ml-2 inline-flex items-center gap-1 rounded-full border border-wl-border px-2 py-0.5 text-[10px] font-semibold text-wl-muted hover:text-wl-text disabled:opacity-60"
                        >
                          <RefreshCw
                            className={cn("h-3 w-3", checking === t.loopTxnReference && "animate-spin")}
                          />
                          Check
                        </button>
                      )}
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums sm:px-4",
                        t.type === "inflow" ? "text-wl-success" : "text-wl-text",
                        t.status === "failed" && "line-through opacity-60",
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
      </div>
    </div>
  );
}
