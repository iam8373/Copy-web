"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FOCUS_RING, HIT_AREA } from "./focus";

export type ChipTone = "neutral" | "highlight";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Toggle state; exposed as aria-pressed. */
  selected?: boolean;
  /** "highlight" is the warm, starred chip (e.g. a featured sub-filter). */
  tone?: ChipTone;
  icon?: ReactNode;
}

/**
 * Filter / sort chip. 32 px visual, 44 px hit area. Selected chips use the
 * brand tint so they read in both themes without relying on colour alone
 * (the border also changes).
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, tone = "neutral", icon, className, children, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      data-active={selected ? "true" : "false"}
      className={cn(
        "relative inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip border px-3 text-12 font-semibold transition-colors duration-xs ease-standard",
        HIT_AREA,
        FOCUS_RING,
        selected && "border-brand bg-brand/15 text-brand",
        !selected &&
          tone === "highlight" &&
          "border-warning/40 bg-warning/10 text-warning hover:border-warning",
        !selected &&
          tone === "neutral" &&
          "border-subtle bg-surface-2 text-secondary hover:border-strong hover:text-primary",
        className
      )}
      {...rest}
    >
      {icon && (
        <span aria-hidden className="shrink-0 [&>svg]:h-3 [&>svg]:w-3">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
});
