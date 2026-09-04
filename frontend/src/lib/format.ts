export function formatKes(amount: number, opts?: { compact?: boolean; signed?: boolean }): string {
  const abs = Math.abs(amount);
  const formatted = opts?.compact
    ? new Intl.NumberFormat("en-KE", {
        notation: abs >= 100_000 ? "compact" : "standard",
        maximumFractionDigits: abs >= 100_000 ? 1 : 0,
      }).format(abs)
    : new Intl.NumberFormat("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(abs);

  const sign = opts?.signed ? (amount > 0 ? "+" : amount < 0 ? "\u2212" : "") : amount < 0 ? "\u2212" : "";
  return `${sign}KSh\u00a0${formatted}`;
}

/**
 * Detects common Kenyan M-Pesa / mobile-money transaction patterns and returns
 * a short human-readable label. Returns null when no pattern matches.
 */
export function mpesaLabel(description: string, category?: string): string | null {
  const d = description.toLowerCase();
  const c = (category ?? "").toLowerCase();
  if (/\bairtime\b/.test(d) || /\bairtime\b/.test(c)) return "Airtime";
  if (/\bb2c\b|\bcash\s*out\b|\bwithdraw/.test(d)) return "M-Pesa Withdrawal";
  if (/\bdeposit\b/.test(d) && /mpesa|m-pesa/.test(d)) return "M-Pesa Deposit";
  if (/\bdeposit\b/.test(d)) return "Deposit";
  if (/send\s*money|\btransfer\b/.test(d) && /mpesa|m-pesa/.test(d)) return "M-Pesa Transfer";
  if (/\bpaybill\b/.test(d)) return "Paybill";
  if (/\btill\b|\bbuy\s*goods\b/.test(d)) return "Till Payment";
  if (/\bpesalink\b/.test(d)) return "PesaLink Transfer";
  if (/\bsalary\b|\bpayroll\b/.test(d)) return "Salary";
  if (/\brent\b/.test(d)) return "Rent";
  if (/\butility\b|\bkplc\b|\bnairobi\s*water\b/.test(d)) return "Utility";
  return null;
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
