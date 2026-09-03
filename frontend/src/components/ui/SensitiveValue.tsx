"use client";

import { usePrivacy } from "@/lib/context/PrivacyContext";
import { formatKes } from "@/lib/format";

/**
 * Renders a KES amount. When privacy mode is on, shows "KSh ••••••••" instead.
 * Layout is preserved — the masked string is the same visual width as a typical balance.
 */
export function SensitiveValue({
  value,
  signed,
  className,
}: {
  value: number;
  signed?: boolean;
  className?: string;
}) {
  const { hidden } = usePrivacy();
  return (
    <span className={className}>
      {hidden ? "KSh ••••••••" : formatKes(value, { signed })}
    </span>
  );
}
