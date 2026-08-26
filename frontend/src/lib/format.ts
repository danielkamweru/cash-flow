export function formatKes(amount: number, opts?: { compact?: boolean; signed?: boolean }): string {
  const abs = Math.abs(amount);
  const formatted = opts?.compact
    ? new Intl.NumberFormat("en-KE", {
        notation: abs >= 100_000 ? "compact" : "standard",
        maximumFractionDigits: abs >= 100_000 ? 1 : 0,
      }).format(abs)
    : new Intl.NumberFormat("en-KE", {
        maximumFractionDigits: 0,
      }).format(abs);

  const sign = opts?.signed ? (amount > 0 ? "+" : amount < 0 ? "−" : "") : amount < 0 ? "−" : "";
  return `${sign}KES ${formatted}`;
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function progressRatio(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, Math.max(0, current / target));
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
