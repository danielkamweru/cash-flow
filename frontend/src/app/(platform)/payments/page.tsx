"use client";

import { PageHeader, StatusPill } from "@/components/ui/primitives";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import {
  fetchMpesaStatus,
  fetchPayment,
  initiateStkPush,
  initiateB2BPayment,
  initiateB2BPayGoods,
  initiateB2CAccountTopUp,
  fetchB2BPayment,
  fetchB2CPayment,
  type MpesaStatus,
  type PaymentRecord,
  type B2BPaymentRecord,
  type B2CPaymentRecord,
} from "@/lib/api/mpesa";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import { cn, formatKes } from "@/lib/format";
import { friendlyError } from "@/lib/friendlyError";
import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, Smartphone, ExternalLink, Building2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Safaricom brand green — uses the Cash-Flow design token --cf-primary (#00A651)
// ---------------------------------------------------------------------------
const MPESA_GREEN = "text-cf-primary";
const MPESA_GREEN_BG = "bg-cf-primary";
const MPESA_GREEN_BORDER = "border-cf-primary";
const MPESA_GREEN_LIGHT = "bg-cf-primary/10";

type PayState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "stk_sent"; checkoutRequestId: string; merchantRequestId: string | null }
  | { kind: "polling"; checkoutRequestId: string }
  | { kind: "success"; receipt: PaymentRecord }
  | { kind: "failed"; message: string }
  | { kind: "cancelled" }
  | { kind: "b2b_submitted"; reference: string; receipt: B2BPaymentRecord }
  | { kind: "b2b_polling"; reference: string }
  | { kind: "b2b_success"; receipt: B2BPaymentRecord }
  | { kind: "b2b_failed"; message: string }
  | { kind: "b2b_timeout"; reference: string }
  | { kind: "paygoods_submitted"; reference: string; receipt: B2BPaymentRecord }
  | { kind: "paygoods_polling"; reference: string }
  | { kind: "paygoods_success"; receipt: B2BPaymentRecord }
  | { kind: "paygoods_failed"; message: string }
  | { kind: "paygoods_timeout"; reference: string }
  | { kind: "b2c_submitted"; reference: string; receipt: B2CPaymentRecord }
  | { kind: "b2c_polling"; reference: string }
  | { kind: "b2c_success"; receipt: B2CPaymentRecord }
  | { kind: "b2c_failed"; message: string }
  | { kind: "b2c_timeout"; reference: string };

function MpesaBadge() {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
      MPESA_GREEN_LIGHT, MPESA_GREEN,
    )}>
      <Smartphone className="h-3.5 w-3.5" />
      M-Pesa · Safaricom Daraja
    </span>
  );
}

function StatusCard({ state, onReset }: { state: PayState; onReset: () => void }) {
  if (state.kind === "idle") return null;

  if (state.kind === "loading") {
    return (
      <div className="cf-card flex items-center gap-3 p-5">
        <span className={cn("h-2 w-2 animate-pulse rounded-full", MPESA_GREEN_BG)} />
        <p className="text-sm text-cf-muted">Sending M-Pesa prompt…</p>
      </div>
    );
  }

  if (state.kind === "stk_sent" || state.kind === "polling") {
    return (
      <div className={cn("cf-card space-y-3 border p-5", MPESA_GREEN_BORDER, MPESA_GREEN_LIGHT)}>
        <div className="flex items-center gap-3">
          <Clock className={cn("h-5 w-5 shrink-0", MPESA_GREEN)} />
          <div>
            <p className={cn("font-display text-base font-semibold", MPESA_GREEN)}>
              Check your phone
            </p>
            <p className="text-sm text-cf-muted">
              An M-Pesa prompt has been sent. Enter your PIN to complete the payment.
            </p>
          </div>
        </div>
        {state.kind === "stk_sent" && state.checkoutRequestId && (
          <p className="text-[11px] text-cf-muted">
            Reference: {state.checkoutRequestId}
          </p>
        )}
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-cf-muted hover:text-cf-text underline"
        >
          Start over
        </button>
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div className="cf-card space-y-2 border border-cf-success/40 bg-cf-success/10 p-5">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 shrink-0 text-cf-success" />
          <p className="font-display text-base font-semibold text-cf-success">Payment successful</p>
        </div>
        <p className="text-sm text-cf-muted">{state.receipt.description}</p>
        <p className="text-sm font-semibold text-cf-text">{formatKes(state.receipt.amount)}</p>
        <button type="button" onClick={onReset} className="text-xs text-cf-muted hover:text-cf-text underline">
          Make another payment
        </button>
      </div>
    );
  }

  if (state.kind === "failed") {
    return (
      <div className="cf-card space-y-2 border border-cf-danger/40 bg-cf-danger/10 p-5">
        <div className="flex items-center gap-3">
          <XCircle className="h-5 w-5 shrink-0 text-cf-danger" />
          <p className="font-display text-base font-semibold text-cf-danger">Payment failed</p>
        </div>
        <p className="text-sm text-cf-muted">{state.message}</p>
        <button type="button" onClick={onReset} className="text-xs text-cf-muted hover:text-cf-text underline">
          Try again
        </button>
      </div>
    );
  }

  if (state.kind === "cancelled") {
    return (
      <div className="cf-card space-y-2 border border-cf-border p-5">
        <p className="text-sm text-cf-muted">Payment cancelled.</p>
        <button type="button" onClick={onReset} className="text-xs text-cf-muted hover:text-cf-text underline">
          Try again
        </button>
      </div>
    );
  }

  if (state.kind === "b2b_submitted" || state.kind === "b2b_polling") {
    return (
      <div className={cn("cf-card space-y-3 border p-5", MPESA_GREEN_BORDER, MPESA_GREEN_LIGHT)}>
        <div className="flex items-center gap-3">
          <Building2 className={cn("h-5 w-5 shrink-0", MPESA_GREEN)} />
          <div>
            <p className={cn("font-display text-base font-semibold", MPESA_GREEN)}>
              B2B payment submitted
            </p>
            <p className="text-sm text-cf-muted">
              Daraja accepted the request. Awaiting the ResultURL callback for final status.
            </p>
          </div>
        </div>
        {state.kind === "b2b_submitted" && state.receipt && (
          <div className="space-y-1 text-xs text-cf-muted">
            <p>Reference: {state.receipt.originatorConversationId}</p>
            <p>Response code: {state.receipt.resultCode ?? "—"}</p>
          </div>
        )}
        <button type="button" onClick={onReset} className="text-xs text-cf-muted hover:text-cf-text underline">
          Start over
        </button>
      </div>
    );
  }

  if (state.kind === "b2b_success") {
    return (
      <div className="cf-card space-y-2 border border-cf-success/40 bg-cf-success/10 p-5">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 shrink-0 text-cf-success" />
          <p className="font-display text-base font-semibold text-cf-success">B2B payment confirmed</p>
        </div>
        <p className="text-sm text-cf-muted">{state.receipt.description}</p>
        <p className="text-sm font-semibold text-cf-text">{formatKes(state.receipt.amount)}</p>
        {state.receipt.transactionId && (
          <p className="text-[11px] text-cf-muted">M-Pesa receipt: {state.receipt.transactionId}</p>
        )}
        <button type="button" onClick={onReset} className="text-xs text-cf-muted hover:text-cf-text underline">
          Make another B2B payment
        </button>
      </div>
    );
  }

  if (state.kind === "b2b_failed") {
    return (
      <div className="cf-card space-y-2 border border-cf-danger/40 bg-cf-danger/10 p-5">
        <div className="flex items-center gap-3">
          <XCircle className="h-5 w-5 shrink-0 text-cf-danger" />
          <p className="font-display text-base font-semibold text-cf-danger">B2B payment failed</p>
        </div>
        <p className="text-sm text-cf-muted">{state.message}</p>
        <button type="button" onClick={onReset} className="text-xs text-cf-muted hover:text-cf-text underline">
          Try again
        </button>
      </div>
    );
  }

  if (state.kind === "b2b_timeout") {
    return (
      <div className="cf-card space-y-2 border border-cf-warning/40 bg-cf-warning/10 p-5">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 shrink-0 text-cf-warning" />
          <p className="font-display text-base font-semibold text-cf-warning">B2B queued — no response yet</p>
        </div>
        <p className="text-sm text-cf-muted">
          Daraja has not returned a result within the queue window. Reference: {state.reference}
        </p>
        <button type="button" onClick={onReset} className="text-xs text-cf-muted hover:text-cf-text underline">
          Start over
        </button>
      </div>
    );
  }

  if (state.kind === "paygoods_submitted" || state.kind === "paygoods_polling") {
    return (
      <div className={cn("cf-card space-y-3 border p-5", MPESA_GREEN_BORDER, MPESA_GREEN_LIGHT)}>
        <div className="flex items-center gap-3">
          <Building2 className={cn("h-5 w-5 shrink-0", MPESA_GREEN)} />
          <div>
            <p className={cn("font-display text-base font-semibold", MPESA_GREEN)}>
              Business Buy Goods submitted
            </p>
            <p className="text-sm text-cf-muted">
              Daraja accepted the request. Awaiting the ResultURL callback for final status.
            </p>
          </div>
        </div>
        {state.kind === "paygoods_submitted" && state.receipt && (
          <div className="space-y-1 text-xs text-cf-muted">
            <p>Reference: {state.receipt.originatorConversationId}</p>
            <p>Response code: {state.receipt.resultCode ?? "—"}</p>
          </div>
        )}
        <button type="button" onClick={onReset} className="text-xs text-cf-muted hover:text-cf-text underline">
          Start over
        </button>
      </div>
    );
  }

  if (state.kind === "paygoods_success") {
    return (
      <div className="cf-card space-y-2 border border-cf-success/40 bg-cf-success/10 p-5">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 shrink-0 text-cf-success" />
          <p className="font-display text-base font-semibold text-cf-success">Business Buy Goods confirmed</p>
        </div>
        <p className="text-sm text-cf-muted">{state.receipt.description}</p>
        <p className="text-sm font-semibold text-cf-text">{formatKes(state.receipt.amount)}</p>
        {state.receipt.transactionId && (
          <p className="text-[11px] text-cf-muted">M-Pesa receipt: {state.receipt.transactionId}</p>
        )}
        <button type="button" onClick={onReset} className="text-xs text-cf-muted hover:text-cf-text underline">
          Make another Buy Goods payment
        </button>
      </div>
    );
  }

  if (state.kind === "paygoods_failed") {
    return (
      <div className="cf-card space-y-2 border border-cf-danger/40 bg-cf-danger/10 p-5">
        <div className="flex items-center gap-3">
          <XCircle className="h-5 w-5 shrink-0 text-cf-danger" />
          <p className="font-display text-base font-semibold text-cf-danger">Business Buy Goods failed</p>
        </div>
        <p className="text-sm text-cf-muted">{state.message}</p>
        <button type="button" onClick={onReset} className="text-xs text-cf-muted hover:text-cf-text underline">
          Try again
        </button>
      </div>
    );
  }

  if (state.kind === "paygoods_timeout") {
    return (
      <div className="cf-card space-y-2 border border-cf-warning/40 bg-cf-warning/10 p-5">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 shrink-0 text-cf-warning" />
          <p className="font-display text-base font-semibold text-cf-warning">Business Buy Goods queued — no response yet</p>
        </div>
        <p className="text-sm text-cf-muted">
          Daraja has not returned a result within the queue window. Reference: {state.reference}
        </p>
        <button type="button" onClick={onReset} className="text-xs text-cf-muted hover:text-cf-text underline">
          Start over
        </button>
      </div>
    );
  }

  return null;
}

function STKPushForm({ status, onSuccess }: { status: MpesaStatus | null; onSuccess: (r: PaymentRecord) => void }) {
  const { entityId } = useEntity();
  const snapshot = useEntityData();
  const toast = useToast();

  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("CASHFLOW");
  const [description, setDescription] = useState("Cash-Flow payment");
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? "");
  const [payState, setPayState] = useState<PayState>({ kind: "idle" });
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = status?.configured ?? false;
  const field = "w-full rounded-xl border border-cf-border bg-cf-surface-2 px-3 py-3 text-sm text-cf-text outline-none focus:border-cf-primary/50 sm:py-2.5";

  function validate(): string | null {
    if (!phone.trim()) return "Phone number is required.";
    const n = Number(amount);
    if (!amount || isNaN(n) || n < 1) return "Amount must be at least KES 1.";
    if (!accountId) return "Please select an account.";
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const err = validate();
    if (err) { setError(err); return; }
    setConfirming(true);
  }

  async function execute() {
    setConfirming(false);
    setPayState({ kind: "loading" });
    setError(null);
    try {
      const res = await initiateStkPush({
        phoneNumber: phone,
        amount: Math.round(Number(amount)),
        accountReference: reference || "CASHFLOW",
        transactionDescription: description || "Cash-Flow payment",
        entityId,
        accountId,
      });

      if (!res.success) {
        setPayState({ kind: "failed", message: res.message });
        toast(res.message, "error");
        return;
      }

      const checkoutRequestId = res.checkoutRequestId ?? "";
      setPayState({
        kind: "stk_sent",
        checkoutRequestId,
        merchantRequestId: res.merchantRequestId,
      });
      toast("M-Pesa prompt sent. Check your phone.", "success");

      // Poll for up to 60 s (every 5 s) to detect callback settlement
      if (checkoutRequestId) {
        setPayState({ kind: "polling", checkoutRequestId });
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          try {
            const payment = await fetchPayment(checkoutRequestId);
            if (payment.status === "completed") {
              clearInterval(interval);
              setPayState({ kind: "success", receipt: payment });
              onSuccess(payment);
              toast("Payment confirmed!", "success");
            } else if (payment.status === "failed") {
              clearInterval(interval);
              setPayState({ kind: "failed", message: "Payment was not completed." });
            }
          } catch {
            // Payment not found yet — keep polling
          }
          if (attempts >= 12) {
            clearInterval(interval);
            // Leave in stk_sent state — user can check manually
            setPayState({ kind: "stk_sent", checkoutRequestId, merchantRequestId: res.merchantRequestId });
          }
        }, 5000);
      }
    } catch (err) {
      const msg = friendlyError(err, "Could not initiate M-Pesa payment. Please try again.");
      setPayState({ kind: "failed", message: msg });
      toast(msg, "error");
    }
  }

  const busy = payState.kind === "loading" || payState.kind === "polling";

  return (
    <>
      <ConfirmModal
        open={confirming}
        title="Confirm M-Pesa payment"
        confirmLabel="Send M-Pesa prompt"
        onConfirm={() => void execute()}
        onCancel={() => setConfirming(false)}
      >
        <p>
          Send an M-Pesa STK Push of{" "}
          <strong className="text-cf-text">{formatKes(Number(amount))}</strong> to{" "}
          <strong className="text-cf-text">{phone}</strong>?
        </p>
        <p className="mt-2 text-xs text-cf-muted">
          The customer will receive a prompt on their phone to enter their M-Pesa PIN.
        </p>
      </ConfirmModal>

      <StatusCard state={payState} onReset={() => { setPayState({ kind: "idle" }); setError(null); }} />

      {(payState.kind === "idle" || payState.kind === "failed" || payState.kind === "cancelled") && (
        <form onSubmit={handleSubmit} className="cf-card space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold">M-Pesa STK Push</h3>
            <MpesaBadge />
          </div>

          {!configured && (
            <div className="rounded-xl border border-cf-warning/40 bg-cf-warning/10 px-4 py-3 text-sm text-cf-text-secondary">
              <p className="font-medium text-cf-text">Daraja credentials not configured</p>
              <p className="mt-1 text-xs text-cf-muted">
                Add <code>DARAJA_CONSUMER_KEY</code>, <code>DARAJA_CONSUMER_SECRET</code>,{" "}
                <code>DARAJA_SHORTCODE</code>, and <code>DARAJA_PASSKEY</code> to{" "}
                <code>backend/.env</code>, then restart the API.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">
                Customer phone (M-Pesa)
              </span>
              <input
                type="tel"
                inputMode="tel"
                required
                placeholder="07XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={field}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">
                Amount (KES)
              </span>
              <input
                type="number"
                inputMode="numeric"
                required
                min={1}
                step={1}
                placeholder="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={field}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">
                Account reference
              </span>
              <input
                type="text"
                maxLength={12}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className={field}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">
                Description
              </span>
              <input
                type="text"
                maxLength={13}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={field}
              />
            </label>
            <label className="block space-y-1.5 text-sm sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">
                Debit from account
              </span>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={field}>
                {snapshot.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {formatKes(a.balance)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <p className="text-sm text-cf-danger">{error}</p>}

          <button
            type="submit"
            disabled={busy || !configured}
            className={cn(
              "w-full rounded-full px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto",
              MPESA_GREEN_BG,
            )}
          >
            {busy ? "Processing…" : "Pay with M-Pesa"}
          </button>
        </form>
      )}
    </>
  );
}

function B2BForm({ status, onSuccess, mode = "buy-goods" }: { status: MpesaStatus | null; onSuccess: () => void; mode?: "buy-goods" | "pay-bill" }) {
  const { entityId } = useEntity();
  const snapshot = useEntityData();
  const toast = useToast();

  const [amount, setAmount] = useState("");
  const [partyB, setPartyB] = useState("");
  const [accountRef, setAccountRef] = useState("CASHFLOW");
  const [requester, setRequester] = useState("");
  const [remarks, setRemarks] = useState("Cash-Flow B2B");
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? "");
  const [b2bState, setB2bState] = useState<PayState>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  const configured = status?.configured ?? false;
  const field = "w-full rounded-xl border border-cf-border bg-cf-surface-2 px-3 py-3 text-sm text-cf-text outline-none focus:border-cf-primary/50 sm:py-2.5";
  const isBuyGoods = mode === "buy-goods";

  function validate(): string | null {
    const n = Number(amount);
    if (!amount || isNaN(n) || n < 1) return "Amount must be at least KES 1.";
    if (!accountRef.trim()) return "Account reference is required.";
    if (accountRef.length > 13) return "Account reference must be ≤ 13 characters.";
    if (partyB && partyB.length > 20) return "Party B must be ≤ 20 characters.";
    if (!accountId) return "Please select an account.";
    return null;
  }

  async function execute() {
    setB2bState({ kind: "loading" });
    setError(null);
    try {
      const res = isBuyGoods
        ? await initiateB2BPayGoods({
            amount: Math.round(Number(amount)),
            accountReference: accountRef.trim().slice(0, 13),
            partyB: partyB.trim() || undefined,
            requester: requester.trim() || undefined,
            remarks: remarks.trim() || "Cash-Flow B2B",
            entityId,
            accountId,
          })
        : await initiateB2BPayment({
            amount: Math.round(Number(amount)),
            accountReference: accountRef.trim().slice(0, 13),
            partyB: partyB.trim() || undefined,
            requester: requester.trim() || undefined,
            remarks: remarks.trim() || "Cash-Flow B2B",
            entityId,
            accountId,
          });

      if (!res.success) {
        setB2bState({ kind: "b2b_failed", message: res.message });
        toast(res.message, "error");
        return;
      }

      const reference = res.reference ?? res.originator_conversation_id ?? res.conversation_id ?? "";
      const submittedKind = isBuyGoods ? "paygoods_submitted" : "b2b_submitted";
      const pollingKind = isBuyGoods ? "paygoods_polling" : "b2b_polling";
      const successKind = isBuyGoods ? "paygoods_success" : "b2b_success";
      const failedKind = isBuyGoods ? "paygoods_failed" : "b2b_failed";
      const timeoutKind = isBuyGoods ? "paygoods_timeout" : "b2b_timeout";

      setB2bState({
        kind: submittedKind,
        reference,
        receipt: {
          originatorConversationId: reference,
          status: "submitted",
          amount: Math.round(Number(amount)),
          description: `M-Pesa B2B — ${accountRef}`,
          date: new Date().toISOString(),
          partyA: null,
          partyB: partyB || null,
          accountReference: accountRef,
          resultCode: res.response_code,
          resultDesc: res.response_description,
          transactionId: null,
        },
      });
      toast(
        isBuyGoods
          ? "Business Buy Goods submitted. Awaiting Daraja confirmation."
          : "B2B payment submitted. Awaiting Daraja confirmation.",
        "success"
      );

      if (reference) {
        setB2bState({ kind: pollingKind, reference });
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          try {
            const payment = await fetchB2BPayment(reference);
            if (payment.status === "completed") {
              clearInterval(interval);
              setB2bState({ kind: successKind, receipt: payment });
              onSuccess();
              toast(
                isBuyGoods
                  ? "Business Buy Goods confirmed!"
                  : "B2B payment confirmed!",
                "success"
              );
            } else if (payment.status === "failed") {
              clearInterval(interval);
              setB2bState({
                kind: failedKind,
                message: payment.resultDesc || "Payment was not completed.",
              });
            } else if (payment.status === "timeout") {
              clearInterval(interval);
              setB2bState({ kind: timeoutKind, reference });
            }
          } catch {
            // Not yet — keep polling
          }
          if (attempts >= 12) {
            clearInterval(interval);
            setB2bState({
              kind: submittedKind,
              reference,
              receipt: {
                originatorConversationId: reference,
                status: "submitted",
                amount: Math.round(Number(amount)),
                description: `M-Pesa B2B — ${accountRef}`,
                date: new Date().toISOString(),
                partyA: null,
                partyB: partyB || null,
                accountReference: accountRef,
                resultCode: null,
                resultDesc: null,
                transactionId: null,
              },
            });
          }
        }, 5000);
      }
    } catch (err) {
      const msg = friendlyError(err, "Could not submit B2B payment. Please try again.");
      setB2bState({ kind: "b2b_failed", message: msg });
      toast(msg, "error");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const err = validate();
    if (err) { setError(err); return; }
    void execute();
  }

  const busy = b2bState.kind === "loading" || b2bState.kind === "b2b_polling";

  return (
    <>
      <StatusCard state={b2bState} onReset={() => { setB2bState({ kind: "idle" }); setError(null); }} />

      {(b2bState.kind === "idle" || b2bState.kind === "b2b_failed") && (
        <form onSubmit={handleSubmit} className="cf-card space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold">
              {isBuyGoods ? "Business Buy Goods" : "Business Pay Bill"}
            </h3>
            <MpesaBadge />
          </div>

          {!configured && (
            <div className="rounded-xl border border-cf-warning/40 bg-cf-warning/10 px-4 py-3 text-sm text-cf-text-secondary">
              <p className="font-medium text-cf-text">Daraja B2B not configured</p>
              <p className="mt-1 text-xs text-cf-muted">
                Add <code>DARAJA_B2B_INITIATOR</code>, <code>DARAJA_B2B_SECURITY_CREDENTIAL</code>,{" "}
                <code>DARAJA_B2B_PARTY_A</code>, <code>DARAJA_B2B_PARTY_B</code>,{" "}
                <code>DARAJA_B2B_RESULT_URL</code> and <code>DARAJA_B2B_QUEUE_TIMEOUT_URL</code>{" "}
                to <code>backend/.env</code>, then restart the API.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Amount (KES)</span>
              <input type="number" required min={1} step={1} placeholder="100"
                value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Receiver shortcode (Party B)</span>
              <input type="text" maxLength={20} placeholder="default from env"
                value={partyB} onChange={(e) => setPartyB(e.target.value)} className={field} />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Account reference (≤ 13)</span>
              <input type="text" required maxLength={13}
                value={accountRef} onChange={(e) => setAccountRef(e.target.value)} className={field} />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Requester phone (optional)</span>
              <input type="tel" placeholder="07XXXXXXXX"
                value={requester} onChange={(e) => setRequester(e.target.value)} className={field} />
            </label>
            <label className="block space-y-1.5 text-sm sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Remarks</span>
              <input type="text" maxLength={100}
                value={remarks} onChange={(e) => setRemarks(e.target.value)} className={field} />
            </label>
            <label className="block space-y-1.5 text-sm sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Debit from account</span>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={field}>
                {snapshot.accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} — {formatKes(a.balance)}</option>
                ))}
              </select>
            </label>
          </div>

          {error && <p className="text-sm text-cf-danger">{error}</p>}

          <button
            type="submit"
            disabled={busy || !configured}
            className={cn(
              "w-full rounded-full px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto",
              MPESA_GREEN_BG,
            )}
          >
            {busy ? "Submitting…" : isBuyGoods ? "Submit Buy Goods" : "Submit Pay Bill"}
          </button>
          <p className="text-[11px] text-cf-muted">
            {isBuyGoods
              ? "Business Buy Goods is asynchronous. Submission only means Daraja accepted the request — final success comes from the ResultURL callback."
              : "Business Pay Bill is asynchronous. Submission only means Daraja accepted the request — final success comes from the ResultURL callback."}
          </p>
        </form>
      )}
    </>
  );
}

function B2CForm({ status, onSuccess }: { status: MpesaStatus | null; onSuccess: () => void }) {
  const snapshot = useEntityData();
  const toast = useToast();
  const [b2cState, setB2cState] = useState<PayState>({ kind: "idle" });
  const [amount, setAmount] = useState("");
  const [partyB, setPartyB] = useState("");
  const [remarks, setRemarks] = useState("Cash-Flow B2C");
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const configured = status?.configured ?? false;
  const field = "w-full rounded-xl border border-cf-border bg-cf-surface-2 px-3 py-3 text-sm text-cf-text outline-none focus:border-cf-primary/50 sm:py-2.5";

  function validate(): string | null {
    const n = Number(amount);
    if (!amount || isNaN(n) || n < 1) return "Amount must be at least KES 1.";
    if (!partyB.trim()) return "Recipient phone is required.";
    if (!accountId) return "Please select an account.";
    return null;
  }

  async function execute() {
    setB2cState({ kind: "loading" });
    setError(null);
    try {
      const res = await initiateB2CAccountTopUp({
        amount: Math.round(Number(amount)),
        accountReference: "CASHFLOW",
        partyB: partyB.trim(),
        remarks: remarks.trim() || "Cash-Flow B2C",
        entityId: snapshot.entity.id,
        accountId,
      });

      if (!res.success) {
        setB2cState({ kind: "b2c_failed", message: res.message });
        toast(res.message, "error");
        return;
      }

      const reference = res.reference ?? res.originator_conversation_id ?? res.conversation_id ?? "";

      setB2cState({
        kind: "b2c_submitted",
        reference,
        receipt: {
          originatorConversationId: reference,
          status: "submitted",
          amount: Math.round(Number(amount)),
          description: `M-Pesa B2C Account Top-Up — ${partyB}`,
          date: new Date().toISOString(),
          partyA: null,
          partyB: partyB || null,
          accountReference: null,
          resultCode: res.response_code,
          resultDesc: res.response_description,
          transactionId: null,
        },
      });
      toast("B2C Account Top-Up submitted. Awaiting Daraja confirmation.", "success");

      if (reference) {
        setB2cState({ kind: "b2c_polling", reference });
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          try {
            const payment = await fetchB2CPayment(reference);
            if (payment.status === "completed") {
              clearInterval(interval);
              setB2cState({ kind: "b2c_success", receipt: payment });
              onSuccess();
              toast("B2C Account Top-Up confirmed!", "success");
            } else if (payment.status === "failed") {
              clearInterval(interval);
              setB2cState({
                kind: "b2c_failed",
                message: payment.resultDesc || "Payment was not completed.",
              });
            } else if (payment.status === "timeout") {
              clearInterval(interval);
              setB2cState({ kind: "b2c_timeout", reference });
            }
          } catch {
            // Not yet — keep polling
          }
          if (attempts >= 12) {
            clearInterval(interval);
            setB2cState({
              kind: "b2c_submitted",
              reference,
              receipt: {
                originatorConversationId: reference,
                status: "submitted",
                amount: Math.round(Number(amount)),
                description: `M-Pesa B2C Account Top-Up — ${partyB}`,
                date: new Date().toISOString(),
                partyA: null,
                partyB: partyB || null,
                accountReference: null,
                resultCode: null,
                resultDesc: null,
                transactionId: null,
              },
            });
          }
        }, 5000);
      }
    } catch (err) {
      const msg = friendlyError(err, "Could not submit B2C payment. Please try again.");
      setB2cState({ kind: "b2c_failed", message: msg });
      toast(msg, "error");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const err = validate();
    if (err) { setError(err); return; }
    void execute();
  }

  const busy = b2cState.kind === "loading" || b2cState.kind === "b2c_polling";

  return (
    <>
      <StatusCard state={b2cState} onReset={() => { setB2cState({ kind: "idle" }); setError(null); }} />

      {(b2cState.kind === "idle" || b2cState.kind === "b2c_failed") && (
        <form onSubmit={handleSubmit} className="cf-card space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold">B2C Account Top-Up</h3>
            <MpesaBadge />
          </div>

          {!configured && (
            <div className="rounded-xl border border-cf-warning/40 bg-cf-warning/10 px-4 py-3 text-sm text-cf-text-secondary">
              <p className="font-medium text-cf-text">Daraja B2C not configured</p>
              <p className="mt-1 text-xs text-cf-muted">
                Add <code>DARAJA_B2B_INITIATOR</code>, <code>DARAJA_B2B_SECURITY_CREDENTIAL</code>,{" "}
                <code>DARAJA_B2B_PARTY_A</code>, <code>DARAJA_B2B_RESULT_URL</code> and <code>DARAJA_B2B_QUEUE_TIMEOUT_URL</code>{" "}
                to <code>backend/.env</code>, then restart the API.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Amount (KES)</span>
              <input type="number" required min={1} step={1} placeholder="100"
                value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Recipient phone (Party B)</span>
              <input type="tel" required maxLength={13} placeholder="07XXXXXXXX"
                value={partyB} onChange={(e) => setPartyB(e.target.value)} className={field} />
            </label>
            <label className="block space-y-1.5 text-sm sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Remarks</span>
              <input type="text" maxLength={100}
                value={remarks} onChange={(e) => setRemarks(e.target.value)} className={field} />
            </label>
            <label className="block space-y-1.5 text-sm sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Debit from account</span>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={field}>
                {snapshot.accounts.map((a: { id: string; name: string; balance: number }) => (
                  <option key={a.id} value={a.id}>{a.name} — {formatKes(a.balance)}</option>
                ))}
              </select>
            </label>
          </div>

          {error && <p className="text-sm text-cf-danger">{error}</p>}

          <button
            type="submit"
            disabled={busy || !configured}
            className={cn(
              "w-full rounded-full px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto",
              MPESA_GREEN_BG,
            )}
          >
            {busy ? "Submitting…" : "Submit Account Top-Up"}
          </button>
          <p className="text-[11px] text-cf-muted">
            B2C Account Top-Up is asynchronous. Submission only means Daraja accepted the request — final success comes from the ResultURL callback.
          </p>
        </form>
      )}
    </>
  );
}

export default function PaymentsPage() {
  const { refresh } = useEntity();
  const [status, setStatus] = useState<MpesaStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [tab, setTab] = useState<"stk" | "b2b" | "pay-goods" | "b2c">("stk");

  useEffect(() => {
    void fetchMpesaStatus()
      .then(setStatus)
      .catch((e) => setStatusError(e instanceof Error ? e.message : "Failed to load status"));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Payments"
        subtitle="M-Pesa payments — STK Push, Business Pay Bill, and Business Buy Goods, powered by Safaricom Daraja."
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={status?.configured ? "connected" : "pending"} />
            <span className="text-xs text-cf-muted">
              {status?.configured ? `Shortcode ${status.shortcode}` : "Not configured"}
            </span>
          </div>
        }
      />

      {statusError && (
        <div className="rounded-xl border border-cf-danger/40 bg-cf-danger/10 px-4 py-3 text-sm text-cf-danger">
          {statusError}
        </div>
      )}

      {/* Provider info card */}
      <section className="cf-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cf-muted">
              Payment provider
            </p>
            <p className={cn("font-display text-2xl font-semibold", MPESA_GREEN)}>
              Safaricom Daraja
            </p>
            <p className="text-sm text-cf-muted">
              M-Pesa STK Push · Sandbox environment
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <MpesaBadge />
            {status && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-right text-xs text-cf-muted">
                <dt>Provider</dt>
                <dd className="text-cf-text">{status.provider}</dd>
                <dt>Environment</dt>
                <dd className="text-cf-text capitalize">{status.environment}</dd>
                <dt>Methods</dt>
                <dd className="text-cf-text">STK Push</dd>
              </dl>
            )}
          </div>
        </div>
        {status?.note && (
          <p className="mt-3 text-xs text-cf-muted">{status.note}</p>
        )}
      </section>

      {/* Payment method tabs */}
      <div className="inline-flex rounded-full border border-cf-border bg-cf-surface p-0.5">
        <button type="button" onClick={() => setTab("stk")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
            tab === "stk"
              ? "bg-gradient-to-r from-cf-primary to-cf-primary-deep text-white shadow-md shadow-cf-primary/25"
              : "text-cf-muted hover:text-cf-text",
          )}>
          M-Pesa Express
        </button>
        <button type="button" onClick={() => setTab("b2b")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
            tab === "b2b"
              ? "bg-gradient-to-r from-cf-primary to-cf-primary-deep text-white shadow-md shadow-cf-primary/25"
              : "text-cf-muted hover:text-cf-text",
          )}>
          Business Pay Bill
        </button>
        <button type="button" onClick={() => setTab("pay-goods")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
            tab === "pay-goods"
              ? "bg-gradient-to-r from-cf-primary to-cf-primary-deep text-white shadow-md shadow-cf-primary/25"
              : "text-cf-muted hover:text-cf-text",
          )}>
          Business Buy Goods
        </button>
        <button type="button" onClick={() => setTab("b2c")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
            tab === "b2c"
              ? "bg-gradient-to-r from-cf-primary to-cf-primary-deep text-white shadow-md shadow-cf-primary/25"
              : "text-cf-muted hover:text-cf-text",
          )}>
          B2C Account Top-Up
        </button>
      </div>

      {tab === "stk" && (<STKPushForm status={status} onSuccess={() => refresh()} />)}
      {tab === "b2b" && (<B2BForm status={status} onSuccess={() => refresh()} mode="pay-bill" />)}
      {tab === "pay-goods" && (<B2BForm status={status} onSuccess={() => refresh()} mode="buy-goods" />)}
      {tab === "b2c" && (<B2CForm status={status} onSuccess={() => refresh()} />)}

      {/* App Sandbox — Open My Portal */}
      <section className="cf-card space-y-4 p-5">
        <div>
          <h3 className="font-display text-lg font-semibold">App Sandbox</h3>
          <p className="mt-1 text-sm text-cf-muted">
            Manage your Safaricom Daraja sandbox applications, credentials, and test phone numbers.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-cf-border bg-[var(--cf-inset)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-cf-muted">Provider</p>
            <p className={cn("mt-1 text-sm font-semibold", MPESA_GREEN)}>Safaricom Daraja</p>
          </div>
          <div className="rounded-xl border border-cf-border bg-[var(--cf-inset)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-cf-muted">Environment</p>
            <p className="mt-1 text-sm font-semibold text-cf-text">Sandbox</p>
          </div>
          <div className="rounded-xl border border-cf-border bg-[var(--cf-inset)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-cf-muted">Payment method</p>
              <p className="mt-1 text-sm font-semibold text-cf-text">M-Pesa STK Push + Business Pay Bill + Business Buy Goods</p>
          </div>
        </div>
        <a
          href="https://developer.safaricom.co.ke"
          target="_blank"
          rel="noreferrer"
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors",
            MPESA_GREEN_BORDER, MPESA_GREEN, MPESA_GREEN_LIGHT,
            "hover:bg-cf-primary/20",
          )}
        >
          <ExternalLink className="h-4 w-4" />
          Open My Portal
        </a>
        <p className="text-xs text-cf-muted">
          Opens the Safaricom Daraja developer portal in a new tab. Create sandbox apps, get
          credentials, and test with the Daraja sandbox test numbers.
        </p>
      </section>
    </div>
  );
}
