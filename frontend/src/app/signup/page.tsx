"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, KeyRound, Lock, Mail, Phone, Shield, TrendingUp, User } from "lucide-react";
import { MatchHint, PasswordInput, PinInput } from "@/components/ui/PasswordInput";
import { useAuth } from "@/lib/context/AuthContext";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function SignUpPage() {
  const router = useRouter();
  const { signUp, user, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace("/dashboard");
  }, [authLoading, user, router]);

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const pinMismatch = confirmPin.length > 0 && pin !== confirmPin;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password) { setError("Password is required."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (!/^\d{4}$/.test(pin)) { setError("Transaction PIN must be exactly 4 digits."); return; }
    if (pin !== confirmPin) { setError("PINs do not match."); return; }

    setSubmitting(true);
    try {
      await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        pin,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !submitting && !passwordMismatch && !pinMismatch;

  return (
    <div className="cf-grid-bg flex min-h-dvh max-w-[100vw] flex-col overflow-x-clip text-cf-text">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-5 sm:px-5 sm:py-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cf-primary to-cf-primary-deep">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold tracking-tight sm:text-xl">Cash-Flow</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-cf-muted">Sign up</p>
          </div>
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-12 sm:px-5 sm:pb-16">
        <div className="rounded-3xl border border-cf-border bg-cf-surface/80 p-5 shadow-cf backdrop-blur sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cf-primary/15 text-cf-primary">
              <Shield className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Create account</h1>
              <p className="mt-1 text-sm text-cf-muted">
                Register for Cash-Flow. On signup we call LOOP{" "}
                <strong className="font-medium text-cf-text">Authorisation</strong> for your app
                credentials from{" "}
                <a
                  href="https://sandbox.loop.co.ke/devportal/my-apps"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cf-primary underline-offset-2 hover:underline"
                >
                  sandbox My Apps
                </a>
                .
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Full name</span>
              <span className="relative flex">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cf-muted" />
                <input
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-cf-border bg-cf-bg px-10 py-3 text-sm outline-none ring-cf-primary/40 focus:ring-2"
                  placeholder="Amina Otieno"
                />
              </span>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Email</span>
              <span className="relative flex">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cf-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-cf-border bg-cf-bg px-10 py-3 text-sm outline-none ring-cf-primary/40 focus:ring-2"
                  placeholder="you@example.com"
                />
              </span>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Phone (optional)</span>
              <span className="relative flex">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cf-muted" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-cf-border bg-cf-bg px-10 py-3 text-sm outline-none ring-cf-primary/40 focus:ring-2"
                  placeholder="+254 7…"
                />
              </span>
            </label>

            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Password</span>
                <PasswordInput
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-cf-border bg-cf-bg py-3 text-sm outline-none ring-cf-primary/40 focus:ring-2"
                  placeholder="At least 6 characters"
                  leftIcon={<Lock className="h-4 w-4" />}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Confirm password</span>
                <PasswordInput
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-cf-border bg-cf-bg py-3 text-sm outline-none ring-cf-primary/40 focus:ring-2"
                  placeholder="Repeat your password"
                  leftIcon={<Lock className="h-4 w-4" />}
                />
                <MatchHint value={password} confirmValue={confirmPassword} />
              </label>
            </div>

            <div className="rounded-2xl border border-cf-primary/25 bg-cf-primary/5 p-4">
              <div className="mb-3 flex items-start gap-2.5">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-cf-primary" />
                <div>
                  <p className="text-sm font-medium text-cf-text">Transaction PIN</p>
                  <p className="mt-0.5 text-xs text-cf-muted">
                    Four digits, entered every time you send money. Keep it separate from your
                    password and do not share it.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">PIN</span>
                  <PinInput
                    required
                    maxLength={4}
                    autoComplete="off"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-xl border border-cf-border bg-cf-bg px-4 py-3 text-center text-lg tracking-[0.5em] outline-none ring-cf-primary/40 focus:ring-2"
                    placeholder="••••"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-cf-muted">Confirm</span>
                  <PinInput
                    required
                    maxLength={4}
                    autoComplete="off"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-xl border border-cf-border bg-cf-bg px-4 py-3 text-center text-lg tracking-[0.5em] outline-none ring-cf-primary/40 focus:ring-2"
                    placeholder="••••"
                  />
                  <MatchHint
                    value={pin}
                    confirmValue={confirmPin}
                    matchText="✓ PINs match"
                    mismatchText="PINs do not match"
                  />
                </label>
              </div>
            </div>

            {error ? (
              <p className="rounded-xl border border-cf-danger/30 bg-cf-danger/10 px-3 py-2 text-sm text-cf-danger">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cf-primary/25 disabled:opacity-60"
            >
              {submitting ? "Creating account…" : "Create account"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-cf-muted">
            Already have an account?{" "}
            <Link href="/signin" className="font-medium text-cf-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
