"use client";

import { SensitiveValue } from "@/components/ui/SensitiveValue";
import { cn, formatKes } from "@/lib/format";
import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  badge,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  badge?: string;
  className?: string;
}) {
  return (
    <div className={cn("cf-card min-w-0 p-4 md:p-5", className)}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cf-muted">{label}</p>
        {badge && (
          <span className="shrink-0 rounded-md bg-[var(--cf-inset)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-cf-muted">
            {badge}
          </span>
        )}
      </div>
      <p
        className={cn(
          "break-words font-display text-xl font-semibold tracking-tight sm:text-2xl md:text-[1.7rem]",
          tone === "primary" && "text-cf-primary",
          tone === "success" && "text-cf-success",
          tone === "warning" && "text-cf-warning",
          tone === "danger" && "text-cf-danger",
          tone === "default" && "text-cf-text",
        )}
      >
        {typeof value === "number" ? <SensitiveValue value={value} /> : value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-cf-muted">{hint}</p>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-semibold tracking-tight text-cf-text sm:text-2xl md:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-cf-muted">{subtitle}</p>}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusPill({
  status,
}: {
  status: string;
}) {
  const map: Record<string, string> = {
    demo: "bg-cf-warning/15 text-cf-warning",
    sample: "bg-cf-info/15 text-cf-info",
    simulated: "bg-cf-primary/15 text-cf-primary",
    unavailable: "bg-[var(--cf-inset)] text-cf-muted",
    connected: "bg-cf-success/15 text-cf-success",
    manual: "bg-cf-primary/20 text-cf-info",
    pending: "bg-cf-warning/15 text-cf-warning",
    coming_soon: "bg-[var(--cf-inset)] text-cf-muted",
    disconnected: "bg-cf-danger/15 text-cf-danger",
    actual: "bg-cf-success/15 text-cf-success",
    estimated: "bg-cf-warning/15 text-cf-warning",
    user_entered: "bg-cf-primary/15 text-cf-primary",
    active_demo: "bg-cf-success/15 text-cf-success",
    paused: "bg-cf-warning/15 text-cf-warning",
    awaiting_authorization: "bg-cf-warning/15 text-cf-warning",
  };
  const label = status.replaceAll("_", " ");
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", map[status] ?? "bg-[var(--cf-inset)] text-cf-muted")}>
      {label}
    </span>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-[var(--cf-inset)]", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="cf-card flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-display text-lg font-semibold text-cf-text">{title}</p>
      <p className="mt-2 max-w-md text-sm text-cf-muted">{body}</p>
    </div>
  );
}

export function ComingSoonBanner({ feature }: { feature: string }) {
  return (
    <div className="mb-4 rounded-xl border border-dashed border-cf-border bg-cf-surface/60 px-4 py-3 text-sm text-cf-muted">
      <span className="font-semibold text-cf-primary">Coming soon / integration required · </span>
      {feature} is architected but not executing live money movement in this build.
    </div>
  );
}
