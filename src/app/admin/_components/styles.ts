import { cn } from "@/lib/utils";
import { FOCUS_RING, HIT_AREA } from "@/components/ui/focus";

/**
 * Server-safe class helpers for the admin panel (the shared Button lives in a
 * client module). Same tokens and sizes as src/components/ui/Button.tsx.
 */
const BASE =
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-btn font-semibold transition-colors duration-xs ease-standard disabled:pointer-events-none disabled:opacity-40";
const VARIANTS = {
  primary: "bg-brand-fill text-white hover:bg-brand-fill-hover",
  secondary: "bg-surface-3 text-primary hover:bg-surface-3/70",
  outline: "border border-strong text-primary hover:bg-surface-3",
  danger: "border border-danger/30 bg-danger/15 text-danger hover:bg-danger/20",
} as const;

export function btn(variant: keyof typeof VARIANTS = "primary", size: "sm" | "md" = "md", className?: string) {
  return cn(BASE, HIT_AREA, FOCUS_RING, VARIANTS[variant], size === "sm" ? "h-8 px-3 text-13" : "h-10 px-4 text-14", className);
}

export const input =
  "h-10 w-full rounded-btn border border-strong bg-surface-1 px-3 text-14 text-primary placeholder:text-muted " + FOCUS_RING;
export const textarea =
  "min-h-24 w-full rounded-btn border border-strong bg-surface-1 px-3 py-2 text-14 text-primary placeholder:text-muted " + FOCUS_RING;
export const label = "text-13 font-semibold text-primary";
export const card = "rounded-card border border-subtle bg-surface-2 p-4 sm:p-5";
export const th = "px-3 py-2 text-left text-12 font-semibold text-secondary";
export const td = "px-3 py-2 text-13 text-primary align-top";
