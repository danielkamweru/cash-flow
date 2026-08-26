"use client";

import { cn } from "@/lib/format";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Brain,
  Building2,
  CircleDollarSign,
  CreditCard,
  Gauge,
  GitBranch,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  Link2,
  PiggyBank,
  Settings,
  Sparkles,
  Truck,
  FileText,
  Target,
  Users,
  Wallet,
  ArrowLeftRight,
  LineChart,
  ShieldCheck,
  Banknote,
  X,
} from "lucide-react";
import { useEntity } from "@/lib/context/EntityContext";
import { useAuth } from "@/lib/context/AuthContext";

type NavItem = { href: string; label: string; icon: LucideIcon; group: string };

const PERSONAL_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Core" },
  { href: "/accounts", label: "Accounts", icon: Wallet, group: "Core" },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, group: "Core" },
  { href: "/cash-flow", label: "Cash Flow", icon: Activity, group: "Core" },
  { href: "/payments", label: "LOOP Payments", icon: Banknote, group: "Core" },
  { href: "/bills", label: "Bills", icon: CreditCard, group: "Core" },
  { href: "/assets", label: "Assets", icon: Landmark, group: "Wealth" },
  { href: "/investments", label: "Investments", icon: PiggyBank, group: "Wealth" },
  { href: "/liabilities", label: "Liabilities", icon: CreditCard, group: "Wealth" },
  { href: "/goals", label: "Goals", icon: Target, group: "Wealth" },
  { href: "/advisor", label: "Advisor", icon: Brain, group: "Intelligence" },
  { href: "/wealth-health", label: "Wealth Health", icon: Gauge, group: "Intelligence" },
  { href: "/intelligence", label: "Market Intelligence", icon: LineChart, group: "Intelligence" },
  { href: "/recommendations", label: "Recommendations", icon: Lightbulb, group: "Intelligence" },
  { href: "/credit-readiness", label: "Credit Readiness", icon: ShieldCheck, group: "Intelligence" },
  { href: "/automation", label: "Automation", icon: GitBranch, group: "Orchestration" },
  { href: "/chama", label: "Chama / Community", icon: Users, group: "Orchestration" },
  { href: "/connections", label: "Data Connections", icon: Link2, group: "System" },
  { href: "/notifications", label: "Notifications", icon: Bell, group: "System" },
  { href: "/settings", label: "Settings", icon: Settings, group: "System" },
];

const BUSINESS_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Core" },
  { href: "/accounts", label: "Accounts", icon: Wallet, group: "Core" },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, group: "Core" },
  { href: "/cash-flow", label: "Cash Flow", icon: Activity, group: "Core" },
  { href: "/payments", label: "LOOP Payments", icon: Banknote, group: "Core" },
  { href: "/suppliers", label: "Suppliers & Payables", icon: Truck, group: "Merchant" },
  { href: "/receivables", label: "Receivables & Invoices", icon: FileText, group: "Merchant" },
  { href: "/advisor", label: "Advisor", icon: Brain, group: "Intelligence" },
  { href: "/intelligence", label: "Market Intelligence", icon: LineChart, group: "Intelligence" },
  { href: "/recommendations", label: "Recommendations", icon: Lightbulb, group: "Intelligence" },
  { href: "/automation", label: "Automation", icon: GitBranch, group: "Orchestration" },
  { href: "/chama", label: "Chama / Community", icon: Users, group: "Orchestration" },
  { href: "/connections", label: "Data Connections", icon: Link2, group: "System" },
  { href: "/notifications", label: "Notifications", icon: Bell, group: "System" },
  { href: "/settings", label: "Settings", icon: Settings, group: "System" },
];

export function Sidebar({
  onNavigate,
  onClose,
}: {
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { entityType } = useEntity();
  const { loopAuthorization } = useAuth();
  const isPersonal = entityType === "PERSONAL";
  const NAV = isPersonal ? PERSONAL_NAV : BUSINESS_NAV;
  const groups = [...new Set(NAV.map((n) => n.group))];

  return (
    <aside className="flex h-full w-full max-w-[280px] flex-col border-r border-wl-border bg-wl-elevated/90 backdrop-blur-md lg:w-[260px]">
      <div className="flex items-center gap-3 border-b border-wl-border px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-wl-primary to-wl-secondary shadow-lg shadow-wl-primary/30">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold tracking-tight text-wl-text">Wealth Loop</p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-wl-muted">
            {isPersonal ? "Personal · Kenya" : "Business · Merchant"}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-wl-border p-2 text-wl-muted hover:text-wl-text lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-wl-muted">
              {group}
            </p>
            <ul className="space-y-0.5">
              {NAV.filter((n) => n.group === group).map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-wl-primary/15 text-wl-text shadow-[inset_3px_0_0_var(--wealth-primary)]"
                          : "text-wl-muted hover:bg-[var(--wealth-inset)] hover:text-wl-text",
                      )}
                    >
                      <Icon className={cn("h-4 w-4", active ? "text-wl-secondary" : "")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-wl-border p-4">
        <div className="rounded-xl border border-dashed border-wl-border bg-wl-surface px-3 py-3">
          <div className="mb-1 flex items-center gap-2 text-xs text-wl-muted">
            <Building2 className="h-3.5 w-3.5 text-ncpa-secondary" />
            Institutional partner
          </div>
          <p className="text-xs text-wl-text-secondary">
            NCPA accent tokens ready — official colours pending brand assets.
          </p>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-wl-muted">
          <CircleDollarSign className="h-3.5 w-3.5 text-wl-success" />
          {isPersonal ? "Personal workspace · pay anyone" : "Merchant workspace · receive & collect"}
          {" · LOOP "}
          {loopAuthorization?.authorized ? "connected" : "sandbox"}
        </div>
      </div>
    </aside>
  );
}
