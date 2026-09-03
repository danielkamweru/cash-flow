"use client";

import { cn } from "@/lib/format";
import { Eye, EyeOff } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useState } from "react";

/** Shared eye-toggle input for passwords and PINs. */
export function PasswordInput({
  className,
  leftIcon,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { leftIcon?: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative flex w-full">
      {leftIcon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cf-muted">
          {leftIcon}
        </span>
      )}
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={cn(className, leftIcon ? "pl-10" : "", "pr-10")}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-cf-muted hover:text-cf-text"
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </span>
  );
}

/** PIN input with eye toggle — preserves centered/tracking style. */
export function PinInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative flex w-full">
      <input
        {...props}
        type={visible ? "text" : "password"}
        inputMode="numeric"
        className={cn(className, "pr-10")}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-cf-muted hover:text-cf-text"
        tabIndex={-1}
        aria-label={visible ? "Hide PIN" : "Show PIN"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </span>
  );
}

/** Inline match feedback shown below a confirm field. */
export function MatchHint({
  value,
  confirmValue,
  matchText = "✓ Passwords match",
  mismatchText = "Passwords do not match",
}: {
  value: string;
  confirmValue: string;
  matchText?: string;
  mismatchText?: string;
}) {
  if (!confirmValue) return null;
  const ok = value === confirmValue;
  return (
    <p className={cn("mt-1 text-xs", ok ? "text-cf-success" : "text-cf-danger")}>
      {ok ? matchText : mismatchText}
    </p>
  );
}
