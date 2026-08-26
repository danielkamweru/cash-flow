"use client";

import { ComingSoonBanner, PageHeader, StatusPill } from "@/components/ui/primitives";
import {
  MERCHANT_PRODUCTS,
  PAY_SEND_PRODUCTS,
  RECEIVE_PRODUCTS,
  fetchLoopProduct,
  fetchLoopStatus,
  productsForSide,
  requiresPin,
  simulateLoopProduct,
  type LoopHistoryEntry,
  type LoopProduct,
  type LoopProductDetail,
  type LoopSide,
  type LoopStatus,
} from "@/lib/api/loop";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import { cn } from "@/lib/format";
import { useCallback, useEffect, useMemo, useState } from "react";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">{label}</span>
      {children}
    </label>
  );
}

function inputClass() {
  return "w-full rounded-xl border border-cf-border bg-cf-surface-2 px-3 py-2.5 text-sm text-cf-text outline-none focus:border-cf-primary/50";
}

function ResultPanel({ value }: { value: unknown }) {
  if (value == null) return null;
  return (
    <pre className="mt-4 max-h-64 overflow-auto rounded-xl border border-cf-border bg-[var(--cf-inset)] p-3 text-[11px] text-cf-text-secondary sm:p-4 sm:text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function HistoryList({ entries }: { entries: LoopHistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-cf-border px-4 py-8 text-center text-sm text-cf-muted">
        No history for this product yet. Run a simulation to create the first entry.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {entries.map((e) => (
        <li
          key={e.id}
          className={cn(
            "rounded-xl border px-4 py-3",
            e.success ? "border-cf-border bg-cf-surface-2/40" : "border-cf-danger/30 bg-cf-danger/5",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-medium text-cf-text">{e.summary}</p>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  e.mode === "live"
                    ? "bg-cf-primary/15 text-cf-primary"
                    : "bg-cf-primary/15 text-cf-primary",
                )}
              >
                {e.mode}
              </span>
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase",
                  e.success ? "text-emerald-500" : "text-cf-danger",
                )}
              >
                {e.success ? "ok" : "failed"}
              </span>
            </div>
          </div>
          <p className="mt-1 text-xs text-cf-muted">{formatWhen(e.at)}</p>
          {e.error && <p className="mt-2 text-xs text-cf-danger">{e.error}</p>}
          {(e.request != null || e.response != null) && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-cf-muted hover:text-cf-text">
                Request / response
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-[var(--cf-inset)] p-3 text-[11px] text-cf-text-secondary">
                {JSON.stringify({ request: e.request, response: e.response }, null, 2)}
              </pre>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

function ProductDetail({
  productId,
  configured,
  tillReady,
  merchantTill,
  onBack,
  onLedgerChange,
}: {
  productId: string;
  configured: boolean;
  tillReady: boolean;
  merchantTill?: string;
  onBack: () => void;
  onLedgerChange?: () => void;
}) {
  const [detail, setDetail] = useState<LoopProductDetail | null>(null);
  const [history, setHistory] = useState<LoopHistoryEntry[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [live, setLive] = useState(false);
  const [pin, setPin] = useState("");
  const canLive = configured && tillReady;

  // A live run posts to the ledger, so tell the backend which account it hits.
  const snapshot = useEntityData();
  const ledgerAccountId =
    snapshot.accounts.find((a) => a.provider === "mpesa")?.id ?? snapshot.accounts[0]?.id;
  const needsPin = requiresPin(productId, live && canLive);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLoopProduct(productId);
      setDetail(data);
      setHistory(data.history ?? []);
      const next: Record<string, string> = {};
      for (const f of data.fields) next[f.key] = f.defaultValue;
      setForm(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSimulate() {
    if (needsPin && !/^\d{4}$/.test(pin)) {
      setError("Enter your 4-digit transaction PIN to send money live.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      // Sent for simulated runs too — the backend records those as `demo`
      // provenance so the Transactions tab reflects what you just did.
      const body: Record<string, unknown> = {
        ...form,
        entityId: snapshot.entity.id,
        ...(ledgerAccountId ? { accountId: ledgerAccountId } : {}),
        ...(needsPin ? { pin } : {}),
      };
      const outcome = await simulateLoopProduct(productId, body, live && canLive);
      if (outcome.history) setHistory(outcome.history);
      setResult(outcome.result ?? outcome);
      if (!outcome.success) {
        setError(outcome.message ?? "Simulation failed");
      } else {
        setPin("");
        onLedgerChange?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="cf-card p-8 text-center text-sm text-cf-muted">Loading product…</div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={onBack} className="text-sm text-cf-primary hover:underline">
          ← All products
        </button>
        <div className="rounded-xl border border-cf-danger/40 bg-cf-danger/10 px-4 py-3 text-sm text-cf-danger">
          {error ?? "Product not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 text-sm text-cf-primary hover:underline"
          >
            ← All products
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-semibold text-cf-text">{detail.name}</h2>
            <StatusPill status={detail.status === "prototyped" ? "coming_soon" : "demo"} />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-cf-muted">{detail.description}</p>
          {productId === "send-money-loop" && (
            <div className="mt-3 rounded-xl border border-cf-warning/40 bg-cf-warning/10 px-4 py-3 text-sm text-cf-text-secondary">
              Live sandbox for this product is broken on LOOP&apos;s gateway. Go back and open{" "}
              <strong className="text-cf-text">Send Money - M-Pesa</strong> or{" "}
              <strong className="text-cf-text">Mpesa Prompt</strong> next.
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-cf-danger/40 bg-cf-danger/10 px-4 py-3 text-sm text-cf-danger">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="cf-card space-y-4 p-5">
          <div>
            <h3 className="font-display text-lg font-semibold">Simulate</h3>
            <p className="mt-1 text-sm text-cf-muted">
              Run another {detail.name.toLowerCase()} and append it to this product&apos;s history.
            </p>
          </div>

          {detail.fields.length > 0 ? (
            <div className="grid gap-4">
              {detail.fields.map((f) => (
                <Field key={f.key} label={f.label}>
                  <input
                    className={inputClass()}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </Field>
              ))}
            </div>
          ) : (
            <p className="text-sm text-cf-muted">No input fields — this action only needs credentials.</p>
          )}

          <label className="flex items-center gap-2 text-sm text-cf-muted">
            <input
              type="checkbox"
              checked={live && canLive}
              disabled={!canLive}
              onChange={(e) => setLive(e.target.checked)}
              className="rounded border-cf-border"
            />
            Live sandbox call (STK / real LOOP gateway)
            {!configured && <span className="text-xs">(needs API keys)</span>}
            {configured && !tillReady && <span className="text-xs">(needs till + till secret)</span>}
          </label>

          {needsPin && (
            <div className="rounded-xl border border-cf-primary/30 bg-cf-primary/5 px-4 py-3">
              <Field label="4-digit transaction PIN">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  autoComplete="off"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className={inputClass()}
                />
              </Field>
              <p className="mt-2 text-xs text-cf-muted">
                Sending money to M-Pesa or Pesalink needs your PIN. Set one in Settings if you
                haven&apos;t yet.
              </p>
            </div>
          )}

          {!tillReady && (
            <div className="rounded-xl border border-cf-warning/40 bg-cf-warning/10 px-4 py-3 text-sm text-cf-text-secondary">
              <p className="font-medium text-cf-text">No LOOP till secret — live STK cannot run yet</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-cf-muted">
                <li>
                  Open{" "}
                  <a
                    className="text-cf-primary hover:underline"
                    href="https://sandbox.loop.co.ke/devportal/my-apps"
                    target="_blank"
                    rel="noreferrer"
                  >
                    LOOP My Apps
                  </a>{" "}
                  → your app → merchant / till details.
                </li>
                <li>
                  Copy your <strong className="text-cf-text">Till number</strong> and matching{" "}
                  <strong className="text-cf-text">Till secret</strong> into{" "}
                  <code>backend/.env</code> as <code>LOOP_DEFAULT_TILL</code> and{" "}
                  <code>LOOP_DEFAULT_TILL_SECRET</code> (same till — secret must match).
                </li>
                <li>Restart the backend, then retry with Live checked.</li>
              </ol>
              <p className="mt-2 text-xs text-cf-muted">
                Until then, leave Live unchecked — simulate still works for UI demos (no phone prompt).
                {merchantTill ? ` Current till in .env: ${merchantTill}.` : ""}
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={() => void onSimulate()}
            className="w-full rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
          >
            {submitting ? "Running…" : detail.simulateLabel}
          </button>

          <ResultPanel value={result} />
        </section>

        <section className="cf-card space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-semibold">History</h3>
              <p className="mt-1 text-sm text-cf-muted">
                Past runs for {detail.name} only — simulated and live.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-full border border-cf-border px-3 py-1.5 text-xs font-semibold text-cf-muted hover:text-cf-text"
            >
              Refresh
            </button>
          </div>
          <HistoryList entries={history} />
        </section>
      </div>
    </div>
  );
}

function ProductGrid({
  products,
  onOpen,
}: {
  products: LoopProduct[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {products.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onOpen(p.id)}
          className="cf-card min-w-0 p-4 text-left transition hover:border-cf-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cf-primary/40 sm:p-5"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="min-w-0 font-display text-base font-semibold sm:text-lg">{p.name}</h3>
            <StatusPill status={p.status === "prototyped" ? "coming_soon" : "demo"} />
          </div>
          <p className="text-sm text-cf-muted">{p.description}</p>
          <p className="mt-4 text-xs font-semibold text-cf-primary">Open · history & simulate →</p>
        </button>
      ))}
    </div>
  );
}

function ProductGroup({
  title,
  subtitle,
  products,
  onOpen,
}: {
  title: string;
  subtitle?: string;
  products: LoopProduct[];
  onOpen: (id: string) => void;
}) {
  if (products.length === 0) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-cf-text">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-cf-muted">{subtitle}</p>}
      </div>
      <ProductGrid products={products} onOpen={onOpen} />
    </section>
  );
}

function YourPaybill({
  merchantTill,
  onOpen,
}: {
  merchantTill?: string;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="cf-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cf-muted">
            Your paybill / till
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums tracking-tight text-cf-text">
            {merchantTill || "—"}
          </p>
          <p className="mt-1 max-w-xl text-sm text-cf-muted">
            This is the number customers pay into. Prompt them with STK or LOOP, then confirm
            settlement with Merchant Transaction Inquiry or History.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen("mpesa-prompt")}
            className="rounded-full border border-cf-primary/40 px-4 py-2 text-xs font-semibold text-cf-text hover:bg-cf-primary/10"
          >
            STK prompt
          </button>
          <button
            type="button"
            onClick={() => onOpen("loop-prompt")}
            className="rounded-full border border-cf-border px-4 py-2 text-xs font-semibold text-cf-muted hover:bg-[var(--cf-inset)] hover:text-cf-text"
          >
            LOOP prompt
          </button>
        </div>
      </div>
    </section>
  );
}

export default function PaymentsPage() {
  // Refreshing the entity snapshot keeps balances and the ledger in step after
  // a payment, so the Transactions tab is current when the user navigates there.
  const { refresh, entityType } = useEntity();
  // Only BUSINESS has a merchant workspace; CHAMA behaves like a personal payer.
  const side: LoopSide = entityType === "BUSINESS" ? "BUSINESS" : "PERSONAL";
  const isPersonal = side === "PERSONAL";
  const [status, setStatus] = useState<LoopStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [callbacks, setCallbacks] = useState<unknown>(null);
  const [loadingCallbacks, setLoadingCallbacks] = useState(false);

  useEffect(() => {
    void fetchLoopStatus()
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load LOOP status"));
  }, []);

  const configured = status?.configured ?? false;
  const tillReady = status?.tillReady ?? false;

  const productCards = useMemo(
    () => productsForSide(status?.products ?? [], side),
    [status, side],
  );
  const receive = useMemo(() => productCards.filter((p) => RECEIVE_PRODUCTS.includes(p.id)), [productCards]);
  const merchant = useMemo(() => productCards.filter((p) => MERCHANT_PRODUCTS.includes(p.id)), [productCards]);
  const paySend = useMemo(() => productCards.filter((p) => PAY_SEND_PRODUCTS.includes(p.id)), [productCards]);

  const header =
    "LOOP payments & transfers";
  const subtitle = isPersonal
    ? "Pay anyone — send money to M-Pesa or PesaLink, or pay any paybill or till."
    : "Merchant workspace — collect with STK / LOOP prompts, check merchant transactions, and pay out.";

  if (selectedId) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title={header}
          subtitle={`${subtitle} Product workspace — history and simulate for each My Apps product.`}
          actions={
            <div className="flex items-center gap-2">
              <StatusPill status={configured ? "connected" : "pending"} />
              <span className="text-xs text-cf-muted">Till {status?.merchantTill ?? "—"}</span>
            </div>
          }
        />
        <ProductDetail
          productId={selectedId}
          configured={configured}
          tillReady={tillReady}
          merchantTill={status?.merchantTill}
          onBack={() => setSelectedId(null)}
          onLedgerChange={refresh}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={header}
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={configured ? "connected" : "pending"} />
            <span className="text-xs text-cf-muted">Till {status?.merchantTill ?? "—"}</span>
          </div>
        }
      />

      {!configured && <ComingSoonBanner feature="LOOP Consumer Key / Secret" />}

      {configured && !tillReady && (
        <div className="rounded-2xl border border-cf-warning/40 bg-cf-warning/10 px-5 py-4 text-sm">
          <p className="font-display text-base font-semibold text-cf-text">Till required for live STK push</p>
          <p className="mt-2 text-cf-muted">
            OAuth keys work, but a real phone STK needs your LOOP merchant till and its secret from{" "}
            <a
              className="text-cf-primary hover:underline"
              href="https://sandbox.loop.co.ke/devportal/my-apps"
              target="_blank"
              rel="noreferrer"
            >
              My Apps
            </a>
            . Put them in <code>LOOP_DEFAULT_TILL</code> / <code>LOOP_DEFAULT_TILL_SECRET</code>, restart
            the API, then use <strong className="text-cf-text">Mpesa Prompt</strong> with Live checked.
          </p>
          <p className="mt-2 text-xs text-cf-muted">
            Without a till you can still demo the flow with Live unchecked (simulated — no STK on the phone).
          </p>
        </div>
      )}

      <div className="cf-card p-4 text-sm text-cf-muted md:p-5">
        <p>
          Portal docs:{" "}
          <a
            className="text-cf-primary hover:underline"
            href="https://sandbox.loop.co.ke/devportal/docs/loop-api/introduction"
            target="_blank"
            rel="noreferrer"
          >
            LOOP API introduction
          </a>
          {" · "}
          <a
            className="text-cf-primary hover:underline"
            href="https://sandbox.loop.co.ke/devportal/my-apps"
            target="_blank"
            rel="noreferrer"
          >
            My Apps
          </a>
        </p>
        <p className="mt-2">{status?.note}</p>
        <p className="mt-2 text-xs">
          Keys stay on the backend only. Set <code>LOOP_CONSUMER_KEY</code> and{" "}
          <code>LOOP_CONSUMER_SECRET</code> in <code>backend/.env</code>, then restart the API.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-cf-danger/40 bg-cf-danger/10 px-4 py-3 text-sm text-cf-danger">
          {error}
        </div>
      )}

      {isPersonal ? (
        <ProductGroup
          title="Pay & send"
          subtitle="Send money anywhere — M-Pesa, PesaLink, LOOP, paybills and tills."
          products={paySend}
          onOpen={setSelectedId}
        />
      ) : (
        <>
          <YourPaybill merchantTill={status?.merchantTill} onOpen={setSelectedId} />

          <ProductGroup
            title="Receive money"
            subtitle="Push an STK or LOOP prompt at a customer to collect payment."
            products={receive}
            onOpen={setSelectedId}
          />

          <ProductGroup
            title="Merchant transactions"
            subtitle="Confirm what actually settled on your merchant account."
            products={merchant}
            onOpen={setSelectedId}
          />

          <ProductGroup
            title="Pay & send"
            subtitle="Settle suppliers and send money to anyone."
            products={paySend}
            onOpen={setSelectedId}
          />
        </>
      )}

      <section className="cf-card space-y-4 p-5">
        <h3 className="font-display text-lg font-semibold">Prompt callbacks</h3>
        <p className="text-sm text-cf-muted">
          LOOP posts async outcomes for LOOP Prompt / M-Pesa Prompt here. Expose this URL publicly
          (e.g. tunnel) for sandbox callbacks to arrive.
        </p>
        <button
          type="button"
          disabled={loadingCallbacks}
          onClick={() => {
            setLoadingCallbacks(true);
            void fetch(
              `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"}/loop/callbacks`,
            )
              .then((r) => r.json())
              .then(setCallbacks)
              .catch((e) => setError(e instanceof Error ? e.message : "Callback fetch failed"))
              .finally(() => setLoadingCallbacks(false));
          }}
          className="w-full rounded-full border border-cf-border px-5 py-2.5 text-sm font-semibold text-cf-text disabled:opacity-60 sm:w-auto"
        >
          {loadingCallbacks ? "Loading…" : "Refresh received callbacks"}
        </button>
        <ResultPanel value={callbacks} />
      </section>
    </div>
  );
}
