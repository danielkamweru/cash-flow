"use client";

import { useTheme } from "@/lib/context/ThemeContext";
import { cn } from "@/lib/format";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      className={cn(
        "relative inline-flex h-9 w-[3.25rem] items-center rounded-full border border-wl-border bg-wl-surface p-1 transition-colors hover:border-wl-primary/40",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-1 left-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-wl-primary to-wl-secondary text-white shadow-md transition-transform duration-300",
          isDark ? "translate-x-0" : "translate-x-[1.35rem]",
        )}
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
      <span className="sr-only">{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}
