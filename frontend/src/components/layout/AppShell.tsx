"use client";

import { EntityProvider, useEntity } from "@/lib/context/EntityContext";
import { useAuth } from "@/lib/context/AuthContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/signin");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <p className="text-sm text-wl-muted">Checking session…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5">
        <p className="text-sm text-wl-muted">Sign in required</p>
        <Link href="/signin" className="text-sm font-medium text-wl-secondary hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

function ApiGate({ children }: { children: React.ReactNode }) {
  const { loading, error, data, refresh } = useEntity();

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-2">
        <p className="text-sm text-wl-muted">Loading live data from API…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 rounded-2xl border border-wl-danger/30 bg-wl-danger/5 p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-wl-text">Backend unavailable</h2>
        <p className="text-sm text-wl-muted">
          Start the FastAPI backend on port 4000, seed Postgres if needed, then retry.
        </p>
        {error && (
          <pre className="overflow-auto rounded-xl bg-[var(--wealth-inset)] p-3 text-xs text-wl-danger">
            {error}
          </pre>
        )}
        <button
          type="button"
          onClick={refresh}
          className="w-full rounded-full bg-gradient-to-r from-wl-primary to-wl-secondary px-5 py-2.5 text-sm font-semibold text-white sm:w-auto"
        >
          Retry
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AuthGate>
      <EntityProvider>
        <div className="wl-grid-bg flex min-h-dvh w-full max-w-[100vw] overflow-x-clip">
          <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[260px]">
            <Sidebar />
          </div>

          {open && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-[var(--wealth-overlay)]"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              />
              <div className="absolute inset-y-0 left-0 flex w-[min(280px,88vw)] max-w-full shadow-2xl">
                <Sidebar onNavigate={() => setOpen(false)} onClose={() => setOpen(false)} />
              </div>
            </div>
          )}

          <div className="flex min-h-dvh min-w-0 flex-1 flex-col lg:pl-[260px]">
            <TopBar onMenu={() => setOpen(true)} />
            <main className="min-w-0 flex-1 px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8">
              <div className="mx-auto w-full min-w-0 max-w-6xl">
                <ApiGate>{children}</ApiGate>
              </div>
            </main>
          </div>
        </div>
      </EntityProvider>
    </AuthGate>
  );
}
