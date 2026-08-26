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
  const display = typeof value === "number" ? formatKes(value) : value;
  return (
    <div className={cn("wl-card min-w-0 p-4 md:p-5", className)}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wl-muted">{label}</p>
        {badge && (
          <span className="shrink-0 rounded-md bg-[var(--wealth-inset)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-wl-muted">
            {badge}
          </span>
        )}
      </div>
      <p
        className={cn(
          "break-words font-display text-xl font-semibold tracking-tight sm:text-2xl md:text-[1.7rem]",
          tone === "primary" && "text-wl-secondary",
          tone === "success" && "text-wl-success",
          tone === "warning" && "text-wl-warning",
          tone === "danger" && "text-wl-danger",
          tone === "default" && "text-wl-text",
        )}
      >
        {display}
      </p>
      {hint && <p className="mt-1.5 text-xs text-wl-muted">{hint}</p>}
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
        <h1 className="font-display text-xl font-semibold tracking-tight text-wl-text sm:text-2xl md:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-wl-muted">{subtitle}</p>}
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
    demo: "bg-wl-warning/15 text-wl-warning",
    sample: "bg-wl-info/15 text-wl-info",
    simulated: "bg-wl-secondary/15 text-wl-secondary",
    unavailable: "bg-[var(--wealth-inset)] text-wl-muted",
    connected: "bg-wl-success/15 text-wl-success",
    manual: "bg-ncpa-primary/20 text-wl-info",
    pending: "bg-wl-warning/15 text-wl-warning",
    coming_soon: "bg-[var(--wealth-inset)] text-wl-muted",
    disconnected: "bg-wl-danger/15 text-wl-danger",
    actual: "bg-wl-success/15 text-wl-success",
    estimated: "bg-wl-warning/15 text-wl-warning",
    user_entered: "bg-ncpa-secondary/15 text-ncpa-secondary",
    active_demo: "bg-wl-success/15 text-wl-success",
    paused: "bg-wl-warning/15 text-wl-warning",
    awaiting_authorization: "bg-wl-warning/15 text-wl-warning",
  };
  const label = status.replaceAll("_", " ");
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", map[status] ?? "bg-[var(--wealth-inset)] text-wl-muted")}>
      {label}
    </span>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-[var(--wealth-inset)]", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-wl-primary to-wl-secondary transition-all duration-700"
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
    <div className="wl-card flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-display text-lg font-semibold text-wl-text">{title}</p>
      <p className="mt-2 max-w-md text-sm text-wl-muted">{body}</p>
    </div>
  );
}

export function ComingSoonBanner({ feature }: { feature: string }) {
  return (
    <div className="mb-4 rounded-xl border border-dashed border-wl-border bg-wl-surface/60 px-4 py-3 text-sm text-wl-muted">
      <span className="font-semibold text-wl-secondary">Coming soon / integration required · </span>
      {feature} is architected but not executing live money movement in this build.
    </div>
  );
}
