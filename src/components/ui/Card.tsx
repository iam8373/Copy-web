import type { ElementType, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type CardPadding = "none" | "sm" | "md";

const PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4 sm:p-5",
};

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  padding?: CardPadding;
  /** Panels (trade panel, chart block) use the larger radius. */
  radius?: "card" | "panel";
  /** Hover affordance for cards that are links or buttons as a whole. */
  interactive?: boolean;
}

/**
 * Surface container. Dark theme relies on the 1 px border; light theme adds
 * `shadow-card` (which is `none` in dark) — see docs/DESIGN.md Elevation.
 */
export function Card({
  as: Tag = "div",
  padding = "md",
  radius = "card",
  interactive = false,
  className,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cn(
        "border border-subtle bg-surface-2 shadow-card",
        radius === "panel" ? "rounded-panel" : "rounded-card",
        PADDING[padding],
        interactive && "transition-colors duration-xs ease-standard hover:border-strong",
        className
      )}
      {...rest}
    />
  );
}
