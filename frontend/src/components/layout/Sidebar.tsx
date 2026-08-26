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
  TrendingUp,
} from "lucide-react";
import { useEntity } from "@/lib/context/EntityContext";
import { useAuth } from "@/lib/context/AuthContext";

type NavItem = { href: string; label: string; icon: LucideIcon; group: string };

const PERSONAL_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Core" },
  { href: "/accounts", label: "Accounts", icon: Wallet, group: "Core" },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, group: "Core" },
  { href: "/cash-flow", label: "Cash Flow", icon: Activity, group: "Core" },
  { href: "/payments", label: "Payments", icon: Banknote, group: "Core" },
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
  { href: "/payments", label: "Payments", icon: Banknote, group: "Core" },
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
    <aside className="flex h-full w-full max-w-[280px] flex-col border-r border-cf-border bg-cf-elevated/90 backdrop-blur-md lg:w-[260px]">
      <div className="flex items-center gap-3 border-b border-cf-border px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cf-primary to-cf-primary-deep shadow-lg shadow-cf-primary/30">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold tracking-tight text-cf-text">Cash-Flow</p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-cf-muted">
            {isPersonal ? "Personal · Kenya" : "Business · Merchant"}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-cf-border p-2 text-cf-muted hover:text-cf-text lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-cf-muted">
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
                          ? "bg-cf-primary/15 text-cf-text shadow-[inset_3px_0_0_var(--cf-primary)]"
                          : "text-cf-muted hover:bg-[var(--cf-inset)] hover:text-cf-text",
                      )}
                    >
                      <Icon className={cn("h-4 w-4", active ? "text-cf-primary" : "")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-cf-border p-4">
        <div className="rounded-xl border border-dashed border-cf-border bg-cf-surface px-3 py-3">
          <div className="mb-1 flex items-center gap-2 text-xs text-cf-muted">
            <Building2 className="h-3.5 w-3.5 text-cf-primary" />
            Financial partner
          </div>
          <p className="text-xs text-cf-text-secondary">
            Built for Kenyan financial infrastructure.
          </p>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-cf-muted">
          <CircleDollarSign className="h-3.5 w-3.5 text-cf-success" />
          {isPersonal ? "Personal workspace · pay anyone" : "Merchant workspace · receive & collect"}
          {" · LOOP "}
          {loopAuthorization?.authorized ? "connected" : "sandbox"}
        </div>
      </div>
    </aside>
  );
}
