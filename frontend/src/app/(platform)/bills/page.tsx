"use client";

import { RecordManager, type FieldSpec } from "@/components/financial/RecordManager";
import { MetricCard, PageHeader } from "@/components/ui/primitives";
import { obligationsApi } from "@/lib/api/resources";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import { cn, formatKes } from "@/lib/format";

const FIELDS: FieldSpec[] = [
  { key: "name", label: "Bill", placeholder: "September rent" },
  { key: "amount", label: "Amount (KES)", kind: "number", placeholder: "35000" },
  { key: "dueDate", label: "Due date", kind: "date" },
  { key: "category", label: "Category", placeholder: "Housing" },
  {
    key: "status",
    label: "Status",
    kind: "select",
    options: [
      { value: "upcoming", label: "Upcoming" },
      { value: "paid", label: "Paid" },
      { value: "overdue", label: "Overdue" },
    ],
  },
];

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

export default function BillsPage() {
  const data = useEntityData();
  const { refresh } = useEntity();

  const bills = [...data.obligations].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );
  const outstanding = bills
    .filter((b) => b.status !== "paid")
    .reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Bills & obligations"
        subtitle="What is committed before any surplus is calculated."
      />
      <MetricCard
        label="Still to pay"
        value={outstanding}
        hint="Subtracted from liquid money before safe-to-spend"
        tone={outstanding > data.liquid ? "danger" : undefined}
      />

      <RecordManager
        title="Upcoming"
        addLabel="Add bill"
        fields={FIELDS}
        items={bills}
        api={obligationsApi}
        emptyMessage="No bills recorded. Add what is due so your surplus accounts for it."
        toValues={(b) => ({
          name: b.name,
          amount: b.amount,
          dueDate: b.dueDate,
          category: b.category,
          status: b.status,
        })}
        toPayload={(v) => ({
          name: String(v.name),
          amount: Number(v.amount),
          dueDate: new Date(String(v.dueDate)).toISOString(),
          category: String(v.category),
          status: String(v.status),
        })}
        renderItem={(b, controls) => {
          const days = daysUntil(b.dueDate);
          const paid = b.status === "paid";
          const late = !paid && days < 0;
          const soon = !paid && days >= 0 && days <= 7;
          return (
            <article className="cf-card flex items-start justify-between gap-3 p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base font-semibold">{b.name}</h3>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      paid && "bg-cf-success/15 text-cf-success",
                      late && "bg-cf-danger/15 text-cf-danger",
                      soon && "bg-cf-warning/15 text-cf-warning",
                      !paid && !late && !soon && "bg-cf-primary/10 text-cf-primary",
                    )}
                  >
                    {paid ? "Paid" : late ? `${Math.abs(days)}d overdue` : `in ${days}d`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-cf-muted">
                  {b.category} · due {b.dueDate.slice(0, 10)}
                </p>
                <p className={cn("mt-2 font-display text-xl font-semibold tabular-nums", paid && "opacity-60")}>
                  {formatKes(b.amount)}
                </p>
                {!paid && (
                  <button
                    type="button"
                    onClick={async () => {
                      await obligationsApi.update(b.entityId, b.id, { status: "paid" });
                      refresh();
                    }}
                    className="mt-3 rounded-full border border-cf-border px-4 py-1.5 text-xs font-semibold text-cf-muted hover:text-cf-text"
                  >
                    Mark paid
                  </button>
                )}
              </div>
              {controls}
            </article>
          );
        }}
      />
    </div>
  );
}
