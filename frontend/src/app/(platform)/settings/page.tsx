"use client";

import { PageHeader } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { apiGet, apiPost } from "@/lib/api/client";
import type { ApiUser } from "@/lib/api/types";
import { useEntityData } from "@/lib/context/EntityContext";
import { useTheme } from "@/lib/context/ThemeContext";
import { cn } from "@/lib/format";
import { ShieldCheck } from "lucide-react";
import { MatchHint, PasswordInput, PinInput } from "@/components/ui/PasswordInput";
import { useEffect, useState } from "react";

/** Sets the 4-digit PIN required for M-Pesa and Pesalink send-money. */
function TransactionPinCard({ hasPin, onSaved }: { hasPin: boolean; onSaved: () => void }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pinMismatch = confirmPin.length > 0 && pin !== confirmPin;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!pin) { setError("PIN is required."); return; }
    if (!/^\d{4}$/.test(pin)) { setError("PIN must be exactly 4 digits."); return; }
    if (pin !== confirmPin) { setError("PINs do not match."); return; }
    if (!password) { setError("Account password is required."); return; }

    setSaving(true);
    try {
      await apiPost("/auth/pin", { pin, password });
      setSaved(true);
      setPin("");
      setConfirmPin("");
      setPassword("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set PIN");
    } finally {
      setSaving(false);
    }
  }

  const field =
    "w-full rounded-xl border border-cf-border bg-cf-surface-2 px-3 py-2.5 text-sm text-cf-text outline-none focus:border-cf-primary/50";

  return (
    <section className="cf-card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Transaction PIN</h2>
          <p className="mt-1 text-sm text-cf-muted">
            Required to send money via M-Pesa or Pesalink. LOOP wallet transfers do not use it.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
            hasPin ? "bg-cf-success/15 text-cf-success" : "bg-cf-warning/15 text-cf-warning",
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {hasPin ? "PIN set" : "No PIN yet"}
        </span>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="block text-xs font-medium uppercase tracking-wide text-cf-muted">
            {hasPin ? "New PIN" : "Choose a PIN"}
          </span>
          <PinInput
            required
            maxLength={4}
            autoComplete="off"
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className={field}
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="block text-xs font-medium uppercase tracking-wide text-cf-muted">
            Confirm PIN
          </span>
          <PinInput
            required
            maxLength={4}
            autoComplete="off"
            placeholder="••••"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
            className={field}
          />
          <MatchHint
            value={pin}
            confirmValue={confirmPin}
            matchText="✓ PINs match"
            mismatchText="PINs do not match"
          />
        </label>
        <label className="space-y-1.5 text-sm sm:col-span-2">
          <span className="block text-xs font-medium uppercase tracking-wide text-cf-muted">
            Confirm with your account password
          </span>
          <PasswordInput
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-cf-border bg-cf-surface-2 px-3 py-2.5 text-sm text-cf-text outline-none focus:border-cf-primary/50"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={saving || pinMismatch}
            className="rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : hasPin ? "Update PIN" : "Set PIN"}
          </button>
          {saved && <span className="text-sm text-cf-success">PIN saved.</span>}
          {error && <span className="text-sm text-cf-danger">{error}</span>}
        </div>
      </form>
    </section>
  );
}

export default function SettingsPage() {
  const data = useEntityData();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    void apiGet<ApiUser>("/user")
      .then(setUser)
      .catch((e) => setUserError(e instanceof Error ? e.message : "Failed to load user"));
  }, [reloadKey]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" subtitle="Profile, risk preferences, and trust controls." />

      <section className="cf-card space-y-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Appearance</h2>
            <p className="text-sm text-cf-muted">Switch between dark and light dashboard themes.</p>
          </div>
          <ThemeToggle />
        </div>
        <div className="inline-flex rounded-full border border-cf-border bg-cf-surface-2 p-1">
          {(["dark", "light"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTheme(option)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors",
                theme === option
                  ? "bg-gradient-to-r from-cf-primary to-cf-primary-deep text-white"
                  : "text-cf-muted hover:text-cf-text",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      <section className="cf-card space-y-3 p-5">
        <h2 className="font-display text-lg font-semibold">Profile</h2>
        {userError && <p className="text-sm text-cf-danger">{userError}</p>}
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-cf-muted">Name</dt>
            <dd>{user?.name ?? "…"}</dd>
          </div>
          <div>
            <dt className="text-cf-muted">Location</dt>
            <dd>{user?.location ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-cf-muted">Email</dt>
            <dd>{user?.email ?? "…"}</dd>
          </div>
          <div>
            <dt className="text-cf-muted">Phone</dt>
            <dd>{user?.phone ?? "—"}</dd>
          </div>
        </dl>
      </section>
      <section className="cf-card space-y-3 p-5">
        <h2 className="font-display text-lg font-semibold">Risk profile · {data.entity.name}</h2>
        {data.risk ? (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-cf-muted">Horizon</dt>
                <dd className="capitalize">{data.risk.horizon}</dd>
              </div>
              <div>
                <dt className="text-cf-muted">Tolerance</dt>
                <dd className="capitalize">{data.risk.tolerance}</dd>
              </div>
              <div>
                <dt className="text-cf-muted">Emergency months</dt>
                <dd>{data.risk.emergencyFundMonthsTarget}</dd>
              </div>
            </dl>
            {data.risk.notes && <p className="text-xs text-cf-muted">{data.risk.notes}</p>}
          </>
        ) : (
          <p className="text-sm text-cf-muted">No risk profile on this entity yet.</p>
        )}
      </section>
      <TransactionPinCard hasPin={Boolean(user?.hasPin)} onSaved={() => setReloadKey((k) => k + 1)} />

      <section className="cf-card p-5 text-sm text-cf-muted">
        Consent, audit history, and provider authorization will live here as integrations come online.
        Cash-Flow uses a modern Kenyan fintech-inspired green design system.
      </section>
    </div>
  );
}
