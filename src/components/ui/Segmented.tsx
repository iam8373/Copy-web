"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FOCUS_RING, HIT_AREA } from "./focus";

export interface SegmentedOption<V extends string = string> {
  value: V;
  label: ReactNode;
  /** Optional tone for the selected state (Yes/No switches). */
  tone?: "neutral" | "yes" | "no";
}

export interface SegmentedProps<V extends string = string> {
  options: SegmentedOption<V>[];
  value: V;
  onValueChange: (value: V) => void;
  /** Accessible name of the group, e.g. "Sort by". */
  label: string;
  size?: "sm" | "md";
  className?: string;
  /** Applied to every option, e.g. a data-testid for tests. */
  optionProps?: (value: V) => Record<string, string>;
}

const SELECTED = {
  neutral: "bg-surface-1 text-primary shadow-card",
  yes: "bg-success/15 text-success",
  no: "bg-danger/15 text-danger",
} as const;

/**
 * One-of-N switch that changes a view in place (sort order, chart range,
 * outcome). Buttons with aria-pressed inside a labelled group; use Tabs
 * instead when each option owns a separate panel of content.
 */
export function Segmented<V extends string>({
  options,
  value,
  onValueChange,
  label,
  size = "sm",
  className,
  optionProps,
}: SegmentedProps<V>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex min-w-0 gap-1 rounded-btn bg-surface-3 p-1", className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            data-active={selected ? "true" : "false"}
            onClick={() => onValueChange(o.value)}
            {...optionProps?.(o.value)}
            className={cn(
              "relative shrink-0 whitespace-nowrap rounded-chip font-semibold transition-colors duration-xs",
              size === "sm" ? "h-8 px-2.5 text-12 sm:px-3 sm:text-13" : "h-9 px-4 text-14",
              HIT_AREA,
              FOCUS_RING,
              selected ? SELECTED[o.tone ?? "neutral"] : "text-secondary hover:text-primary"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
