"use client";

import { PageHeader, StatusPill } from "@/components/ui/primitives";
import { apiDownload, apiGet } from "@/lib/api/client";
import { useEntityData } from "@/lib/context/EntityContext";
import { cn, formatDate, formatKes, mpesaLabel } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-cf-success/15 text-cf-success",
  pending: "bg-cf-warning/15 text-cf-warning",
  failed: "bg-cf-danger/15 text-cf-danger",
  cancelled: "bg-[var(--cf-inset)] text-cf-muted",
};

function TxnStatusBadge({ status }: { status?: string }) {
  const s = status ?? "completed";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        STATUS_STYLES[s] ?? "bg-[var(--cf-inset)] text-cf-muted",
      )}
    >
      {s}
    </span>
  );
}

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

export default function TransactionsPage() {
  const data = useEntityData();
  const entityId = data.entity.id;

  const [start, setStart] = useState(startOfMonth);
  const [end, setEnd] = useState(() => toInputDate(new Date()));
  const [rows, setRows] = useState<Transaction[]>(data.transactions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

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

      <section className="cf-card space-y-4 p-4 sm:p-5">
        {/* Date pickers — full width on mobile, inline on sm+ */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-medium uppercase tracking-wide text-cf-muted">From</span>
            <input
              type="date"
              value={start}
              max={end || undefined}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-xl border border-cf-border bg-cf-surface-2 px-3 py-3 text-sm text-cf-text outline-none focus:border-cf-primary/50 sm:w-auto sm:py-2"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block text-xs font-medium uppercase tracking-wide text-cf-muted">To</span>
            <input
              type="date"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-xl border border-cf-border bg-cf-surface-2 px-3 py-3 text-sm text-cf-text outline-none focus:border-cf-primary/50 sm:w-auto sm:py-2"
            />
          </label>
        </div>

        {/* Preset chips — scrollable row on mobile */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                const [s, e] = p.range();
                setStart(s);
                setEnd(e);
              }}
              className="shrink-0 rounded-full border border-cf-border px-3 py-2 text-xs font-medium text-cf-muted transition-colors hover:border-cf-primary/40 hover:text-cf-text sm:py-1.5"
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setStart(""); setEnd(""); }}
            className="shrink-0 rounded-full border border-cf-border px-3 py-2 text-xs font-medium text-cf-muted transition-colors hover:border-cf-primary/40 hover:text-cf-text sm:py-1.5"
          >
            All time
          </button>
        </div>

        {/* Export buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void onExport("xlsx")}
            disabled={exporting !== null}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-cf-border px-4 py-2.5 text-xs font-semibold text-cf-text transition-colors hover:border-cf-primary/40 disabled:opacity-60 sm:flex-none sm:py-2"
          >
            {exporting === "xlsx" ? (
              <Download className="h-3.5 w-3.5 animate-pulse" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5 text-cf-success" />
            )}
            Excel
          </button>
          <button
            type="button"
            onClick={() => void onExport("pdf")}
            disabled={exporting !== null}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-cf-border px-4 py-2.5 text-xs font-semibold text-cf-text transition-colors hover:border-cf-primary/40 disabled:opacity-60 sm:flex-none sm:py-2"
          >
            {exporting === "pdf" ? (
              <Download className="h-3.5 w-3.5 animate-pulse" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-cf-danger" />
            )}
            PDF
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["Inflow", totals.inflow, "text-cf-success"],
              ["Outflow", totals.outflow, "text-cf-text"],
              ["Net", totals.net, totals.net >= 0 ? "text-cf-success" : "text-cf-danger"],
            ] as const
          ).map(([label, value, tone]) => (
            <div key={label} className="rounded-xl border border-cf-border bg-[var(--cf-inset)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-cf-muted">{label}</p>
              <p className={cn("font-display text-lg font-semibold tabular-nums", tone)}>{formatKes(value)}</p>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-cf-danger">{error}</p>}
      </section>

      <div className="cf-card overflow-hidden">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-cf-border bg-cf-surface-2/50 text-[11px] uppercase tracking-wide text-cf-muted">
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
                  <td colSpan={5} className="px-3 py-8 sm:px-4 text-center text-cf-muted">
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 sm:px-4 text-center text-cf-muted">
                    No transactions in this period.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((t) => (
                  <tr key={t.id} className="border-b border-cf-border/70">
                    <td className="whitespace-nowrap px-3 py-3 text-cf-muted sm:px-4">{formatDate(t.date)}</td>
                    <td className="px-3 py-3 sm:px-4">
                      <p className="max-w-[200px] truncate text-cf-text sm:max-w-none sm:whitespace-normal">
                        {t.description}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <StatusPill status={t.provenance} />
                        {mpesaLabel(t.description, t.category) && (
                          <span className="rounded-md bg-cf-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-cf-primary">
                            {mpesaLabel(t.description, t.category)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-cf-muted sm:px-4">{t.category}</td>
                    <td className="px-3 py-3 sm:px-4">
                      <TxnStatusBadge status={t.status} />
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums sm:px-4",
                        t.type === "inflow" ? "text-cf-success" : "text-cf-text",
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
