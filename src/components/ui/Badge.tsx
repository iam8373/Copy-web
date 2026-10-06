import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "brand" | "success" | "danger" | "warning";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-3 text-secondary",
  brand: "bg-brand/15 text-brand",
  success: "bg-success/15 text-success",
  danger: "bg-danger/15 text-danger",
  warning: "bg-warning/15 text-warning",
};

const DOTS: Record<BadgeTone, string> = {
  // No bg-secondary colour exists (secondary is a text token), so read the var.
  neutral: "bg-[rgb(var(--text-secondary))]",
  brand: "bg-brand",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Leading status dot; `pulse` animates it (stops under reduced motion). */
  dot?: boolean | "pulse";
  icon?: ReactNode;
}

/** Small, non-interactive status label (Live, Demo data, Resolved …). */
export function Badge({ tone = "neutral", dot, icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-chip px-1.5 text-11 font-semibold uppercase tracking-wide",
        TONES[tone],
        className
      )}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            DOTS[tone],
            dot === "pulse" && "animate-pulse-dot"
          )}
        />
      )}
      {icon && (
        <span aria-hidden className="shrink-0 [&>svg]:h-3 [&>svg]:w-3">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
