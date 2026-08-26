"use client";

import { PageHeader, StatusPill } from "@/components/ui/primitives";
import { apiGet } from "@/lib/api/client";
import type { ApiProvider } from "@/lib/api/types";
import { fetchLoopStatus, type LoopStatus } from "@/lib/api/loop";
import type { ConnectionStatus } from "@/lib/types";
import Link from "next/link";
import { useEffect, useState } from "react";

function asStatus(raw: string): ConnectionStatus {
  const v = raw.toLowerCase();
  if (v === "connected" || v === "demo" || v === "manual" || v === "pending" || v === "disconnected" || v === "coming_soon") {
    return v;
  }
  return "demo";
}

export default function ConnectionsPage() {
  const [loop, setLoop] = useState<LoopStatus | null>(null);
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchLoopStatus()
      .then(setLoop)
      .catch(() => setLoop(null));
    void apiGet<ApiProvider[]>("/providers")
      .then(setProviders)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load providers"));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Data connections"
        subtitle="Provider registry from the API plus LOOP Developer Portal products."
      />

      <section className="wl-card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">LOOP sandbox (NCBA)</h2>
            <p className="text-sm text-wl-muted">
              {loop?.note ?? "LOOP status endpoint unavailable — configure Consumer Key/Secret in the API."}
            </p>
          </div>
          <StatusPill status={loop?.configured ? "connected" : "pending"} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(loop?.products ?? []).map((p) => (
            <div key={p.id} className="rounded-xl border border-wl-border bg-[var(--wealth-inset)] p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-wl-text">{p.name}</p>
                <StatusPill status={p.status === "prototyped" ? "coming_soon" : "demo"} />
              </div>
              <p className="text-xs text-wl-muted">{p.description}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/payments"
            className="rounded-full bg-gradient-to-r from-wl-primary to-wl-secondary px-5 py-2.5 text-sm font-semibold text-white"
          >
            Open LOOP Payments
          </Link>
          <a
            href="https://sandbox.loop.co.ke/devportal/my-apps"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-wl-border px-5 py-2.5 text-sm font-medium text-wl-text"
          >
            My Apps portal
          </a>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-wl-danger/40 bg-wl-danger/10 px-4 py-3 text-sm text-wl-danger">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((p) => (
          <article key={p.id} className="wl-card p-5">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="font-display text-lg font-semibold">{p.name}</h3>
              <StatusPill status={asStatus(p.status)} />
            </div>
            <p className="text-sm text-wl-muted">{p.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.capabilities.map((c) => (
                <span
                  key={c}
                  className="rounded-md bg-[var(--wealth-inset)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-wl-muted"
                >
                  {c}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
