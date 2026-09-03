import { cn } from "@/lib/format";
import type { HTMLAttributes } from "react";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn("animate-pulse rounded-xl bg-cf-surface-2", className)}
    />
  );
}

/** A card-shaped skeleton that matches the cf-card pattern. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("cf-card p-4 sm:p-5", className)}>
      <Skeleton className="mb-3 h-3 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="mt-3 h-3 w-1/2" />
    </div>
  );
}

/** Four metric tiles — mirrors NetWorthHero layout. */
export function SkeletonNetWorth() {
  return (
    <div className="cf-card p-4 sm:p-5 md:p-7">
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="h-10 w-48" />
      <Skeleton className="mt-1 h-3 w-40" />
      <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-cf-border bg-[var(--cf-inset)] px-2.5 py-3">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="mt-2 h-5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Bar chart skeleton. */
export function SkeletonChart() {
  return (
    <div className="cf-card p-4 sm:p-5">
      <Skeleton className="mb-4 h-4 w-28" />
      <div className="flex h-44 items-end gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-1 items-end justify-center gap-0.5">
            <Skeleton
              className="w-[42%] rounded-t-md"
              style={{ height: `${40 + Math.sin(i) * 30 + 30}%` } as React.CSSProperties}
            />
            <Skeleton
              className="w-[42%] rounded-t-md"
              style={{ height: `${30 + Math.cos(i) * 25 + 25}%` } as React.CSSProperties}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Three goal card skeletons. */
export function SkeletonGoals() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="cf-card p-4 sm:p-5">
          <Skeleton className="mb-2 h-4 w-1/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="mt-3 h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Dashboard full-page skeleton — shown while EntityContext is loading. */
export function SkeletonDashboard() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <SkeletonNetWorth />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <SkeletonCard className="min-h-[160px]" />
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonChart />
        <SkeletonGoals />
      </div>
    </div>
  );
}
