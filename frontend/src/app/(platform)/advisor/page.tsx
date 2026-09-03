"use client";

import { PageHeader } from "@/components/ui/primitives";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import {
  fetchAdvice,
  type AdvisorAction,
  type AdvisorFinding,
  type AdvisorReport,
  type AdvisorSeverity,
} from "@/lib/api/advisor";
import { fundGoal, invest, payDebt } from "@/lib/api/resources";
import { useEntity } from "@/lib/context/EntityContext";
import { cn, formatKes } from "@/lib/format";
import { friendlyError } from "@/lib/friendlyError";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  ChevronDown,
  Info,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const SEVERITY: Record<AdvisorSeverity, { label: string; chip: string; Icon: typeof Info }> = {
  critical: { label: "Critical", chip: "bg-cf-danger/15 text-cf-danger", Icon: ShieldAlert },
  high: { label: "High", chip: "bg-cf-danger/10 text-cf-danger", Icon: AlertTriangle },
  medium: { label: "Medium", chip: "bg-cf-warning/15 text-cf-warning", Icon: AlertTriangle },
  low: { label: "Low", chip: "bg-cf-primary/10 text-cf-primary", Icon: Info },
  info: { label: "Insight", chip: "bg-cf-success/12 text-cf-success", Icon: Info },
};

const AGENT_NAMES: Record<string, string> = {
  cashflow: "Cash-flow agent",
  spending: "Spending agent",
  emergency: "Emergency-fund agent",
  debt: "Debt agent",
  goals: "Goals agent",
  allocation: "Allocation agent",
};

const RANGES = [
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "12 months", months: 12 },
];

function FindingCard({ finding }: { finding: AdvisorFinding }) {
  const [open, setOpen] = useState(false);
  const meta = SEVERITY[finding.severity] ?? SEVERITY.info;
  const { Icon } = meta;

  return (
    <article className="cf-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 p-5 text-left"
      >
        <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.chip)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-base font-semibold text-cf-text">{finding.title}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", meta.chip)}>
              {meta.label}
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-cf-muted">
              {AGENT_NAMES[finding.agent] ?? finding.agent}
            </span>
          </span>
          <span className="mt-1.5 block text-sm text-cf-muted">{finding.detail}</span>
        </span>
        {finding.evidence.length > 0 && (
          <ChevronDown
            className={cn("mt-1 h-4 w-4 shrink-0 text-cf-muted transition-transform", open && "rotate-180")}
          />
        )}
      </button>

      {open && finding.evidence.length > 0 && (
        <div className="border-t border-cf-border bg-[var(--cf-inset)] px-5 py-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cf-muted">
            What this is based on
          </p>
          <ul className="space-y-1">
            {finding.evidence.map((e) => (
              <li key={e} className="text-sm tabular-nums text-cf-text-secondary">
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

/** Turns one proposed action into a real movement of money. */
function ExecutePanel({
  action,
  onDone,
}: {
  action: AdvisorAction;
  onDone: () => void;
}) {
  const { entityId, data: snapshot } = useEntity();
  const accounts = snapshot?.accounts ?? [];
  const goals = snapshot?.goals ?? [];
  const liabilities = snapshot?.liabilitiesList ?? [];

  // Match the action back to the record it refers to, by name.
  const goal = goals.find((g) => action.title.includes(g.name));
  const liability = liabilities.find((l) => action.title.includes(l.name));
  const kind = liability ? "debt" : goal ? "goal" : action.instrument ? "invest" : null;

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState(String(action.amount ?? 0));
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const toast = useToast();

  if (!kind) return null;

  const field =
    "w-full rounded-xl border border-cf-border bg-cf-surface-2 px-3 py-2.5 text-sm text-cf-text outline-none focus:border-cf-primary/50";

  async function run(e: React.FormEvent) {
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
      const value = Number(amount);
      if (kind === "debt" && liability) {
        const res = await payDebt(entityId, { accountId, liabilityId: liability.id, amount: value });
        const msg = `${liability.name} balance is now ${formatKes(res.liability.balance)}.`;
        setDone(msg);
        toast(msg, "success");
      } else if (kind === "goal" && goal) {
        const res = await fundGoal(entityId, { accountId, goalId: goal.id, amount: value });
        const msg = `${goal.name} is now at ${formatKes(res.goal.current)}.`;
        setDone(msg);
        toast(msg, "success");
      } else {
        const res = await invest(entityId, {
          accountId,
          amount: value,
          instrument: action.instrument!,
          name: action.instrumentLabel ?? undefined,
        });
        const msg = `${res.investment.name} now holds ${formatKes(res.investment.value)}.`;
        setDone(msg);
        toast(msg, "success");
      }
      onDone();
    } catch (err) {
      const msg = friendlyError(err, "Could not complete this action. Please try again.");
      setError(msg);
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  const account = accounts.find((a) => a.id === accountId);

  return (
    <>
      <ConfirmModal
        open={confirming}
        title="Confirm action"
        confirmLabel={
          kind === "debt" ? "Make payment" : kind === "goal" ? "Move to goal" : "Invest"
        }
        onConfirm={() => void execute()}
        onCancel={() => setConfirming(false)}
      >
        <p>
          Move <strong className="text-cf-text">{formatKes(Number(amount))}</strong> from{" "}
          <strong className="text-cf-text">{account?.name ?? "selected account"}</strong>
          {kind === "debt" && liability && (
            <> toward <strong className="text-cf-text">{liability.name}</strong></>
          )}
          {kind === "goal" && goal && (
            <> into <strong className="text-cf-text">{goal.name}</strong></>
          )}
          {kind === "invest" && (
            <> into <strong className="text-cf-text">{action.instrumentLabel ?? "investment"}</strong></>
          )}
          ?
        </p>
      </ConfirmModal>

      <form onSubmit={run} className="mt-4 space-y-3 rounded-xl border border-cf-border bg-[var(--cf-inset)] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">From</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={field}>
            {accounts.map((a) => (
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
      {done && <p className="text-sm text-cf-success">{done}</p>}

      <button
        type="submit"
        disabled={busy || !accountId}
        className="rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy
          ? "Working…"
          : kind === "debt"
            ? "Make this payment"
            : kind === "goal"
              ? "Move it to the goal"
              : "Invest it"}
      </button>
    </form>
    </>
  );
}

export default function AdvisorPage() {
  const { entityId, data: snapshot, refresh } = useEntity();
  const [openAction, setOpenAction] = useState<number | null>(null);
  const [report, setReport] = useState<AdvisorReport | null>(null);
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchAdvice(entityId, months));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate advice");
    } finally {
      setLoading(false);
    }
  }, [entityId, months]);

  useEffect(() => {
    void load();
  }, [load]);

  const entityName = snapshot?.entity.name ?? "this profile";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Advisor"
        subtitle={`Agents read ${entityName}'s transactions and balances, then propose what to save and where to invest.`}
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-cf-border px-4 py-2 text-xs font-semibold text-cf-text hover:border-cf-primary/40 disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Re-analyse
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-cf-muted">History analysed</span>
        {RANGES.map((r) => (
          <button
            key={r.months}
            type="button"
            onClick={() => setMonths(r.months)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              months === r.months
                ? "border-cf-primary/50 bg-cf-primary/10 text-cf-text"
                : "border-cf-border text-cf-muted hover:text-cf-text",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-cf-danger/40 bg-cf-danger/10 px-4 py-3 text-sm text-cf-danger">
          {error}
        </div>
      )}

      {loading && !report && (
        <div className="cf-card p-10 text-center text-sm text-cf-muted">Agents are reading your books…</div>
      )}

      {report && (
        <>
          <section className="cf-card space-y-4 p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cf-primary to-cf-primary-deep">
                <Brain className="h-5 w-5 text-white" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold text-cf-text">{report.headline}</h2>
                <p className="mt-1.5 text-sm text-cf-muted">{report.summary}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["Monthly income", report.metrics.monthlyIncome, "text-cf-success"],
                  ["Monthly spending", report.metrics.monthlyExpenses, "text-cf-text"],
                  ["Monthly surplus", report.metrics.monthlySurplus,
                    report.metrics.monthlySurplus >= 0 ? "text-cf-success" : "text-cf-danger"],
                  ["Emergency cover", report.metrics.emergencyCover, "text-cf-text"],
                ] as const
              ).map(([label, value, tone]) => (
                <div key={label} className="rounded-xl border border-cf-border bg-[var(--cf-inset)] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-cf-muted">{label}</p>
                  <p className={cn("font-display text-lg font-semibold tabular-nums", tone)}>
                    {formatKes(value)}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-xs text-cf-muted">
              {report.agents.length} agents · {report.metrics.transactionsAnalysed} transactions over{" "}
              {report.metrics.monthsAnalysed} months
            </p>
          </section>

          {report.actions.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-cf-primary" />
                <h2 className="font-display text-xl font-semibold">Your plan, in order</h2>
              </div>
              <p className="text-sm text-cf-muted">
                Work down the list. Each step says what it costs and where the money should sit.
              </p>

              <ol className="space-y-3">
                {report.actions.map((a, i) => (
                  <li key={`${a.title}-${i}`} className="cf-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cf-primary/10 text-xs font-semibold text-cf-primary">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-display text-base font-semibold text-cf-text">{a.title}</p>
                          <p className="mt-1 text-sm text-cf-muted">{a.rationale}</p>
                        </div>
                      </div>
                      {a.amount != null && (
                        <div className="text-right">
                          <p className="font-display text-lg font-semibold tabular-nums text-cf-text">
                            {formatKes(a.amount)}
                          </p>
                          {a.cadence && <p className="text-xs text-cf-muted">{a.cadence}</p>}
                        </div>
                      )}
                    </div>

                    {(a.instrumentLabel || a.risk || a.liquidity) && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        {a.instrumentLabel && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cf-primary/10 px-3 py-1 font-medium text-cf-primary">
                            <ArrowRight className="h-3 w-3" />
                            {a.instrumentLabel}
                          </span>
                        )}
                        {a.risk && (
                          <span className="rounded-full border border-cf-border px-3 py-1 capitalize text-cf-muted">
                            {a.risk} risk
                          </span>
                        )}
                        {a.liquidity && (
                          <span className="rounded-full border border-cf-border px-3 py-1 text-cf-muted">
                            {a.liquidity}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setOpenAction(openAction === i ? null : i)}
                        className="rounded-full border border-cf-primary/40 px-4 py-1.5 text-xs font-semibold text-cf-text hover:bg-cf-primary/10"
                      >
                        {openAction === i ? "Close" : "Do this"}
                      </button>
                      {a.assumptions.length > 0 && (
                        <details>
                          <summary className="cursor-pointer text-xs text-cf-muted hover:text-cf-text">
                            Assumptions
                          </summary>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-cf-muted">
                            {a.assumptions.map((s) => (
                              <li key={s}>{s}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>

                    {openAction === i && (
                      <ExecutePanel
                        action={a}
                        onDone={() => {
                          refresh();
                          void load();
                        }}
                      />
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold">What the agents found</h2>
            <div className="space-y-3">
              {report.findings.map((f, i) => (
                <FindingCard key={`${f.agent}-${i}`} finding={f} />
              ))}
            </div>
          </section>

          <p className="rounded-xl border border-cf-border bg-cf-surface px-4 py-3 text-xs text-cf-muted">
            {report.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}
