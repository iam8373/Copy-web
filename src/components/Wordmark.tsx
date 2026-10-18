import { cn } from "@/lib/utils";

/**
 * BharatPredict's mark and wordmark (S4). Original artwork: a rounded square
 * with three rising bars and a forecast tick — "a market's view moving up".
 * Uses design tokens only, so it follows both themes.
 *
 * To use a supplied logo file later, change ONLY this file: replace the <svg>
 * in BrandMark with the logo (e.g. next/image from /public/brand/logo.svg) and
 * keep the props. The icons, manifest and social image draw the same mark
 * from BRAND_MARK_PATHS below.
 */

/** The mark as plain shapes on a 32×32 grid (reused by the generated images). */
export const BRAND_MARK_PATHS = {
  bars: [
    { x: 7, y: 17, width: 4.5, height: 8, rx: 1.5 },
    { x: 13.75, y: 13, width: 4.5, height: 12, rx: 1.5 },
    { x: 20.5, y: 9, width: 4.5, height: 16, rx: 1.5 },
  ],
  tick: "M6.5 13.5 L13 8.5 L17 11 L25 5.5",
} as const;

export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0 text-brand-fill", className)}
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      {BRAND_MARK_PATHS.bars.map((b) => (
        <rect key={b.x} {...b} fill="white" opacity={0.95} />
      ))}
      <path d={BRAND_MARK_PATHS.tick} fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
    </svg>
  );
}

/**
 * Mark + "BharatPredict". The text is always in the DOM (it is the accessible
 * name); `compact` hides it visually below the xs breakpoint (header on a 360-wide screen
 * next to long sign-in labels).
 */
export function Wordmark({
  size = "md",
  compact = false,
  className,
}: {
  size?: "sm" | "md" | "lg";
  compact?: boolean;
  className?: string;
}) {
  const mark = size === "sm" ? 22 : size === "lg" ? 40 : 28;
  const text = size === "sm" ? "text-14" : size === "lg" ? "text-24" : "text-18";
  return (
    <span className={cn("inline-flex items-center gap-2", className)} data-testid="wordmark">
      <BrandMark size={mark} />
      <span className={cn("font-bold tracking-tight text-primary", text, compact && "sr-only xs:not-sr-only")}>
        Bharat<span className="text-brand">Predict</span>
      </span>
    </span>
  );
}
