"use client";

import { cn } from "@/lib/format";
import { Eye, EyeOff } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useState } from "react";

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
