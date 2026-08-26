"use client";

import {
  approveRule,
  declineRule,
  enableRule,
  evaluateEntityAutomation,
  patchRule,
  type RuleEvaluation,
} from "@/lib/api/automation";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import { cn, formatKes } from "@/lib/format";
import type { AutomationRule, RuleRun, RuleRunOutcome } from "@/lib/types";
import { useCallback, useMemo, useState } from "react";
import { PageHeader, StatusPill } from "@/components/ui/primitives";

const OUTCOME_TONE: Record<RuleRunOutcome, string> = {
  proposed: "bg-cf-warning/15 text-cf-warning",
  approved: "bg-cf-success/15 text-cf-success",
  executed: "bg-cf-success/15 text-cf-success",
  declined: "bg-cf-danger/15 text-cf-danger",
  guarded: "bg-cf-info/15 text-cf-info",
  skipped: "bg-[var(--cf-inset)] text-cf-muted",
  failed: "bg-cf-danger/15 text-cf-danger",
};

const TRIGGER_LABEL: Record<string, string> = {
  income_detected: "Income threshold",
  due_date: "Due-date window",
  weekly_recon: "Weekly recon",
  low_balance: "Liquid floor",
};

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function RunTimeline({ ruleId, runs }: { ruleId: string; runs: RuleRun[] }) {
  const own = useMemo(() => runs.filter((r) => r.ruleId === ruleId).slice(0, 6), [ruleId, runs]);
  if (own.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-cf-border px-3 py-4 text-center text-xs text-cf-muted">
        No runs yet. Proposals appear here once a trigger fires.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {own.map((r) => (
        <li key={r.id} className="rounded-xl border border-cf-border bg-cf-surface-2/40 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                OUTCOME_TONE[r.outcome] ?? OUTCOME_TONE.skipped,
              )}
            >
              {r.outcome}
            </span>
            <span className="text-[10px] text-cf-muted">{formatWhen(r.triggeredAt)}</span>
          </div>
          {r.proposedAmount != null && (
            <p className="mt-1 text-sm font-semibold text-cf-text">
              {formatKes(r.proposedAmount ?? 0)} · mode {r.runMode}
            </p>
          )}
          {r.detail && (
            <p className="mt-1 text-xs leading-relaxed text-cf-muted">
              {r.detail}
              {r.txnReference ? ` · ref ${r.txnReference}` : ""}
            </p>
          )}
          {r.error && <p className="mt-1 text-xs text-cf-danger">{r.error}</p>}
        </li>
      ))}
    </ul>
  );
}

function RuleCard({
  rule,
  runs,
  busy,
  onRefresh,
}: {
  rule: AutomationRule;
  runs: RuleRun[];
  busy: boolean;
  onRefresh: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [live, setLive] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<RuleEvaluation["evaluation"] | null>(null);

  const canApprove = rule.status === "awaiting_authorization";
  const canSimulate = rule.status === "active_demo";
  const canEnable = rule.status === "declined" || rule.status === "coming_soon" || rule.status === "paused";

  async function run(fn: () => Promise<unknown>, ok: string) {
    setError(null);
    try {
      await fn();
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  }

  async function onApprove() {
    if (live && !/^\d{4}$/.test(pin)) {
      setError("Enter your 4-digit transaction PIN to execute live.");
      return;
    }
    await run(
      () => approveRule(rule.id, live ? { pin, live: true } : { live: false }),
      "Approved",
    );
    setPin("");
  }

  async function onEvaluate() {
    setEvaluating(true);
    setError(null);
    try {
      const res = await evaluateEntityAutomation(rule.entityId);
      const hit = res.results.find((r) => r.ruleId === rule.id);
      setEvalResult(hit?.evaluation ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <article className="cf-card flex flex-col p-5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-cf-text">{rule.name}</h3>
        <StatusPill status={rule.status} />
      </div>
      <p className="text-sm text-cf-muted">{rule.description}</p>

      <dl className="mt-4 space-y-2 text-xs">
        <div>
          <dt className="text-cf-muted">Trigger</dt>
          <dd className="text-cf-text">{rule.trigger}</dd>
        </div>
        <div>
          <dt className="text-cf-muted">Action</dt>
          <dd className="text-cf-text">{rule.action}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {rule.triggerSpec?.kind && (
          <span className="rounded-full border border-cf-border bg-cf-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wide text-cf-muted">
            {TRIGGER_LABEL[rule.triggerSpec.kind] ?? rule.triggerSpec.kind}
          </span>
        )}
        {rule.nextRunAt && (
          <span className="rounded-full border border-cf-border bg-cf-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wide text-cf-muted">
            Next run {formatWhen(rule.nextRunAt)}
          </span>
        )}
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-cf-muted">
          <input
            type="checkbox"
            checked={rule.autoApprove}
            disabled={busy}
            onChange={(e) => {
              setError(null);
              void patchRule(rule.id, { autoApprove: e.target.checked }).catch((err) =>
                setError(err instanceof Error ? err.message : "Update failed"),
              );
            }}
            className="rounded border-cf-border"
          />
          Auto-approve
        </label>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-cf-danger/40 bg-cf-danger/10 px-3 py-2 text-xs text-cf-danger">
          {error}
        </p>
      )}

      {evalResult && (
        <div
          className={cn(
            "mt-3 rounded-xl border px-3 py-2.5 text-xs",
            evalResult.fired
              ? "border-cf-warning/40 bg-cf-warning/10"
              : "border-cf-border bg-cf-surface-2/40",
          )}
        >
          <p className="font-semibold uppercase tracking-wide text-cf-text">
            Last check · {evalResult.outcome}
            {evalResult.amount != null ? ` · ${formatKes(evalResult.amount ?? 0)}` : ""}
          </p>
          <p className="mt-1 leading-relaxed text-cf-muted">{evalResult.detail}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canApprove && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onApprove()}
              className="rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Approve & execute
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => declineRule(rule.id), "Declined")}
              className="rounded-full border border-cf-border px-4 py-2 text-sm font-semibold text-cf-muted hover:text-cf-text disabled:opacity-60"
            >
              Decline
            </button>
            <label className="flex items-center gap-1.5 text-xs text-cf-muted">
              <input
                type="checkbox"
                checked={live}
                onChange={(e) => setLive(e.target.checked)}
                className="rounded border-cf-border"
              />
              Live (real LOOP gateway)
            </label>
            {live && (
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                autoComplete="off"
                placeholder="PIN ••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-20 rounded-xl border border-cf-border bg-cf-surface-2 px-2 py-1.5 text-center text-sm text-cf-text outline-none focus:border-cf-primary/50"
              />
            )}
          </>
        )}
        {canSimulate && (
          <button
            type="button"
            disabled={busy || evaluating}
            onClick={() => void onEvaluate()}
            className="rounded-full border border-cf-border px-4 py-2 text-sm font-semibold text-cf-muted hover:text-cf-text disabled:opacity-60"
          >
            {evaluating ? "Checking…" : "Check trigger now"}
          </button>
        )}
        {canEnable && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => enableRule(rule.id), "Enabled")}
            className="rounded-full border border-cf-border px-4 py-2 text-sm font-semibold text-cf-muted hover:text-cf-text disabled:opacity-60"
          >
            Enable rule
          </button>
        )}
        {!canApprove && !canSimulate && !canEnable && (
          <span className="text-xs text-cf-muted">Waiting on schedule / authorization</span>
        )}
      </div>

      <div className="mt-4 border-t border-cf-border pt-3">
        <RunTimeline ruleId={rule.id} runs={runs} />
      </div>
    </article>
  );
}

export default function AutomationPage() {
  const { refresh } = useEntity();
  const data = useEntityData();
  const [error, setError] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [checkResult, setCheckResult] = useState<RuleEvaluation[] | null>(null);

  const onRefresh = useCallback(() => refresh(), [refresh]);

  async function onRunAll() {
    setRunningAll(true);
    setError(null);
    try {
      const res = await evaluateEntityAutomation(data.entity.id);
      setCheckResult(res.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check failed");
    } finally {
      setRunningAll(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Cash-Flow automation"
        subtitle="Trigger checks run on a schedule and on every API start. Money-moving rules pause at authorization unless auto-approve is on — simulated execution posts demo ledger entries."
        actions={
          <button
            type="button"
            disabled={runningAll}
            onClick={() => void onRunAll()}
            className="rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {runningAll ? "Checking…" : "Run all trigger checks now"}
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-cf-danger/40 bg-cf-danger/10 px-4 py-3 text-sm text-cf-danger">
          {error}
        </div>
      )}

      {checkResult && (
        <div className="cf-card space-y-2 p-5">
          <h3 className="font-display text-base font-semibold">Latest check</h3>
          {checkResult.map((r) => (
            <div
              key={r.ruleId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cf-surface-2/40 px-3 py-2 text-sm"
            >
              <span className="text-cf-text">{r.ruleName}</span>
              <span className="text-xs text-cf-muted">
                {r.evaluation.outcome}
                {r.evaluation.amount != null ? ` · ${formatKes(r.evaluation.amount ?? 0)}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data.automation.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            runs={data.ruleRuns ?? []}
            busy={runningAll}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  );
}