"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Lock, Mail, Shield, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function SignInPage() {
  const router = useRouter();
  const { signIn, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("amina@example.com");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace("/dashboard");
  }, [authLoading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="wl-grid-bg flex min-h-dvh max-w-[100vw] flex-col overflow-x-clip text-wl-text">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-5 sm:px-5 sm:py-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-wl-primary to-wl-secondary">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold tracking-tight sm:text-xl">Wealth Loop</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-wl-muted">Sign in</p>
          </div>
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-12 sm:px-5 sm:pb-16">
        <div className="rounded-3xl border border-wl-border bg-wl-surface/80 p-5 shadow-wl backdrop-blur sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ncpa-primary/15 text-ncpa-secondary">
              <Shield className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Welcome back</h1>
              <p className="mt-1 text-sm text-wl-muted">
                Sign in to Wealth Loop. Authorization uses LOOP sandbox Authorisation (
                <a
                  href="https://sandbox.loop.co.ke/devportal/my-apps"
                  target="_blank"
                  rel="noreferrer"
                  className="text-wl-secondary underline-offset-2 hover:underline"
                >
                  My Apps
                </a>
                ).
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-wl-muted">Email</span>
              <span className="relative flex">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wl-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-wl-border bg-wl-bg px-10 py-3 text-sm outline-none ring-wl-secondary/40 focus:ring-2"
                  placeholder="you@example.com"
                />
              </span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-wl-muted">Password</span>
              <span className="relative flex">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wl-muted" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-wl-border bg-wl-bg px-10 py-3 text-sm outline-none ring-wl-secondary/40 focus:ring-2"
                  placeholder="••••••••"
                />
              </span>
            </label>

            {error ? (
              <p className="rounded-xl border border-wl-danger/30 bg-wl-danger/10 px-3 py-2 text-sm text-wl-danger">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-wl-primary to-wl-secondary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-wl-primary/25 disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-wl-muted">
            New here?{" "}
            <Link href="/signup" className="font-medium text-wl-secondary hover:underline">
              Create an account
            </Link>
          </p>
          <p className="mt-3 text-center text-[11px] text-wl-muted">
            Demo: amina@example.com / demo1234
          </p>
        </div>
      </main>
    </div>
  );
}
