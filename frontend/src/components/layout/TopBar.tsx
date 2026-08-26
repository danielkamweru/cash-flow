"use client";

import { useAuth } from "@/lib/context/AuthContext";
import { useEntity } from "@/lib/context/EntityContext";
import { formatKes, formatRelative, cn } from "@/lib/format";
import { Bell, LogOut, Menu, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function TopBar({ onMenu }: { onMenu?: () => void }) {
  const { entityType, setEntityType, data, consolidatedNetWorth, source } = useEntity();
  const { user, loopAuthorization, signOut } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 border-b border-cf-border bg-cf-bg/80 px-3 backdrop-blur-xl sm:px-4 md:px-6">
      <div className="flex min-h-14 items-center justify-between gap-2 py-2 sm:min-h-16 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onMenu}
            className="shrink-0 rounded-lg border border-cf-border p-2 text-cf-muted lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div
            className="inline-flex max-w-full shrink rounded-full border border-cf-border bg-cf-surface p-0.5 sm:p-1"
            role="tablist"
            aria-label="Entity context"
          >
            {(["PERSONAL", "BUSINESS"] as const).map((type) => (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={entityType === type}
                onClick={() => setEntityType(type)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-all sm:px-4 sm:py-1.5 sm:text-xs",
                  entityType === type
                    ? "bg-gradient-to-r from-cf-primary to-cf-primary-deep text-white shadow-md shadow-cf-primary/25"
                    : "text-cf-muted hover:text-cf-text",
                )}
              >
                <span className="sm:hidden">{type === "PERSONAL" ? "Me" : "Biz"}</span>
                <span className="hidden sm:inline">{type === "PERSONAL" ? "Personal" : "Business"}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="hidden min-w-0 items-center gap-4 lg:flex xl:gap-6">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.14em] text-cf-muted">Consolidated net worth</p>
            <p className="font-display text-sm font-semibold text-cf-text">
              {data ? formatKes(consolidatedNetWorth) : "—"}
            </p>
          </div>
          <div className="h-8 w-px shrink-0 bg-cf-border" />
          <div className="flex min-w-0 items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-pulse-soft rounded-full opacity-60",
                  loopAuthorization?.authorized ? "bg-cf-success" : "bg-cf-warning",
                )}
              />
              <span
                className={cn(
                  "relative inline-flex h-2.5 w-2.5 rounded-full",
                  loopAuthorization?.authorized ? "bg-cf-success" : "bg-cf-warning",
                )}
              />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-cf-text">{data?.health.tier ?? "…"}</p>
              <p className="truncate text-[10px] text-cf-muted">
                {data ? `Wealth Health · ${formatRelative(data.asOf)}` : "Connecting to API…"}
                {" · "}
                {source.toUpperCase()}
                {" · LOOP "}
                {loopAuthorization?.authorized ? "authorized" : "pending"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Link
            href="/notifications"
            className="relative rounded-lg border border-cf-border p-2 text-cf-muted hover:text-cf-text"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cf-primary" />
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-full border border-cf-border bg-cf-surface p-1 sm:py-1 sm:pl-1 sm:pr-3"
            aria-label="Settings"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cf-primary text-sm font-semibold text-white">
              <User className="h-4 w-4" />
            </span>
            <span className="hidden min-w-0 text-xs md:block">
              <span className="block max-w-[100px] truncate font-medium text-cf-text xl:max-w-[140px]">
                {user?.name ?? "Profile"}
              </span>
              <span className="block max-w-[100px] truncate text-cf-muted xl:max-w-[140px]">
                {user?.email ?? "Account"}
              </span>
            </span>
          </Link>
          <button
            type="button"
            aria-label="Sign out"
            onClick={() => {
              signOut();
              router.push("/signin");
            }}
            className="rounded-lg border border-cf-border p-2 text-cf-muted hover:text-cf-text"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Compact status strip on phones / tablets */}
      <div className="flex items-center justify-between gap-3 border-t border-cf-border/60 pb-2 pt-1.5 lg:hidden">
        <p className="min-w-0 truncate text-[11px] text-cf-muted">
          <span className="font-medium text-cf-text">{data?.health.tier ?? "…"}</span>
          {" · "}
          {data ? formatKes(consolidatedNetWorth) : "—"}
        </p>
        <p className="shrink-0 text-[10px] text-cf-muted">
          LOOP {loopAuthorization?.authorized ? "ok" : "pending"}
        </p>
      </div>
    </header>
  );
}
