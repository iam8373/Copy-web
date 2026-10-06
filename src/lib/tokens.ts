/**
 * Design tokens for non-CSS consumers (Recharts props, SVG attributes, canvas).
 * Every value references a CSS variable from src/app/globals.css, so themes
 * switch automatically. This is a token file: hex/px are allowed only here,
 * in globals.css and in tailwind.config.ts (npm run check:tokens).
 */
const v = (name: string, alpha?: number) =>
  alpha === undefined ? `rgb(var(${name}))` : `rgb(var(${name}) / ${alpha})`;

export const color = {
  surface1: v("--surface-1"),
  surface2: v("--surface-2"),
  surface3: v("--surface-3"),
  borderSubtle: v("--border-subtle"),
  borderStrong: v("--border-strong"),
  textPrimary: v("--text-primary"),
  textSecondary: v("--text-secondary"),
  textMuted: v("--text-muted"),
  brand: v("--brand"),
  brandFill: v("--brand-fill"),
  success: v("--success"),
  danger: v("--danger"),
  warning: v("--warning"),
  /** With alpha, e.g. area fills: color.alpha("--brand", 0.3). */
  alpha: v,
} as const;

/** Okabe-Ito outcome palette, in order. Use chartColor(i) for outcome i. */
export const CHART_PALETTE = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--chart-6",
  "--chart-7",
  "--chart-8",
] as const;

export function chartColor(index: number, alpha?: number): string {
  return v(CHART_PALETTE[index % CHART_PALETTE.length], alpha);
}

/** Numeric sizes for libraries that take numbers (px) instead of CSS. */
export const size = {
  axisFont: 11,
  tooltipFont: 12,
  tooltipRadius: 8,
  axisWidth: 46,
  lineWidth: 2,
  dotRadius: 4,
} as const;

/** Media queries for JS (matchMedia); mirror Tailwind's screens. */
export const media = {
  lg: "(min-width: 1024px)",
  reducedMotion: "(prefers-reduced-motion: reduce)",
} as const;

/** Motion (ms) for JS-driven animation; mirrors tailwind.config.ts. */
export const motion = {
  xs: 150,
  sm: 220,
  md: 400,
  lg: 500,
  staggerStep: 30,
  staggerMax: 8,
  easeEmphasized: "cubic-bezier(0.19, 1, 0.22, 1)",
  easeStandard: "cubic-bezier(0.4, 0, 0.2, 1)",
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
} as const;

/** Recharts tooltip container style, shared by every chart. */
export const tooltipStyle = {
  background: color.surface3,
  border: `1px solid ${color.borderSubtle}`,
  borderRadius: size.tooltipRadius,
  fontSize: size.tooltipFont,
  color: color.textPrimary,
} as const;
