"use client";

import { EntityProvider, useEntity } from "@/lib/context/EntityContext";
import { useAuth } from "@/lib/context/AuthContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
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
        <p className="text-sm text-cf-muted">Checking session…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5">
        <p className="text-sm text-cf-muted">Sign in required</p>
        <Link href="/signin" className="text-sm font-medium text-cf-primary hover:underline">
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
    return <SkeletonDashboard />;
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 rounded-2xl border border-cf-border bg-cf-surface p-6">
        <h2 className="font-display text-lg font-semibold text-cf-text">
          We couldn&apos;t load your financial data
        </h2>
        <p className="text-sm text-cf-muted">
          This usually means the API is unreachable. Check your connection or restart the backend,
          then try again.
        </p>
        <button
          type="button"
          onClick={refresh}
          className="rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep px-5 py-2.5 text-sm font-semibold text-white"
        >
          Try again
        </button>
        {error && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-cf-muted hover:text-cf-text">
              Technical details
            </summary>
            <pre className="mt-2 overflow-auto rounded-xl bg-[var(--cf-inset)] p-3 text-xs text-cf-danger">
              {error}
            </pre>
          </details>
        )}
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
        <div className="cf-grid-bg flex min-h-dvh w-full max-w-[100vw] overflow-x-clip">
          <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[260px]">
            <Sidebar />
          </div>

          {open && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-[var(--cf-overlay)]"
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
