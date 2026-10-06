import type { Config } from "tailwindcss";

/**
 * DESIGN TOKENS — see docs/DESIGN.md. Values live in src/app/globals.css as
 * CSS variables (per theme); this file only names them for Tailwind.
 * Everything below EXTENDS Tailwind's defaults; nothing is replaced.
 */
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic surfaces (bg-surface-1 …).
        surface: {
          1: rgb("--surface-1"),
          2: rgb("--surface-2"),
          3: rgb("--surface-3"),
        },
        brand: {
          DEFAULT: rgb("--brand"),
          fill: rgb("--brand-fill"),
          "fill-hover": rgb("--brand-fill-hover"),
        },
        success: rgb("--success"),
        danger: rgb("--danger"),
        warning: rgb("--warning"),
        chart: {
          1: rgb("--chart-1"),
          2: rgb("--chart-2"),
          3: rgb("--chart-3"),
          4: rgb("--chart-4"),
          5: rgb("--chart-5"),
          6: rgb("--chart-6"),
          7: rgb("--chart-7"),
          8: rgb("--chart-8"),
        },
        // Brand tokens kept for compatibility; they resolve to the semantic
        // variables so both themes stay correct.
        accent: {
          green: rgb("--success"),
          red: rgb("--danger"),
          blue: rgb("--brand"),
          strong: rgb("--brand-fill-hover"),
          yellow: rgb("--warning"),
        },
        // Legacy names, removed once the token cleanup batches finish.
        bg: {
          primary: rgb("--surface-1"),
          secondary: rgb("--surface-2"),
          tertiary: rgb("--surface-3"),
        },
        subtle: rgb("--border-subtle"),
        strong: rgb("--border-strong"),
        content: {
          primary: rgb("--text-primary"),
          secondary: rgb("--text-secondary"),
          muted: rgb("--text-muted"),
        },
      },
      // text-primary / text-secondary / text-muted
      textColor: {
        primary: rgb("--text-primary"),
        secondary: rgb("--text-secondary"),
        muted: rgb("--text-muted"),
      },
      // border-subtle / border-strong
      borderColor: {
        subtle: rgb("--border-subtle"),
        strong: rgb("--border-strong"),
      },
      fontFamily: {
        // Inter first (Latin + digits), then the active Noto, then system UI.
        sans: ["var(--font-inter)", "var(--font-indic)", "system-ui", "sans-serif"],
        // Aligned numerals only (order book, tables).
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      // Type scale: size / line-height.
      fontSize: {
        "11": ["11px", "14px"],
        "12": ["12px", "16px"],
        "13": ["13px", "18px"],
        "14": ["14px", "20px"],
        "16": ["16px", "24px"],
        "18": ["18px", "26px"],
        "20": ["20px", "24px"],
        "24": ["24px", "28px"],
        "32": ["32px", "40px"],
      },
      spacing: {
        // Page gutter: 16px below md, 24px from md (CSS variable).
        gutter: "var(--gutter)",
        // Minimum touch target.
        touch: "44px",
        // Trade panel column on lg.
        panel: "360px",
      },
      maxWidth: {
        content: "1280px",
      },
      minHeight: {
        touch: "44px",
      },
      minWidth: {
        touch: "44px",
      },
      borderRadius: {
        chip: "4px",
        btn: "8px",
        card: "12px",
        panel: "18px",
        dialog: "24px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        popover: "var(--shadow-popover)",
        dialog: "var(--shadow-dialog)",
      },
      transitionDuration: {
        xs: "150ms",
        sm: "220ms",
        md: "400ms",
        lg: "500ms",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0, 0, 0.2, 1)",
        standard: "cubic-bezier(0.4, 0, 0.2, 1)",
        emphasized: "cubic-bezier(0.19, 1, 0.22, 1)",
      },
      keyframes: {
        "flash-up": {
          "0%, 100%": { color: "inherit" },
          "20%": { color: "rgb(var(--success))" },
        },
        "flash-down": {
          "0%, 100%": { color: "inherit" },
          "20%": { color: "rgb(var(--danger))" },
        },
        "slide-up": {
          from: { transform: "translateY(16px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        // Order-confirmation success animation.
        "check-draw": {
          from: { strokeDashoffset: "1" },
          to: { strokeDashoffset: "0" },
        },
        "fill-pop": {
          "0%": { transform: "scale(0.82)", opacity: "0" },
          "55%": { transform: "scale(1.03)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "fill-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
      },
      animation: {
        "flash-up": "flash-up 900ms cubic-bezier(0, 0, 0.2, 1)",
        "flash-down": "flash-down 900ms cubic-bezier(0, 0, 0.2, 1)",
        "slide-up": "slide-up 220ms cubic-bezier(0, 0, 0.2, 1)",
        "fade-in": "fade-in 220ms cubic-bezier(0, 0, 0.2, 1)",
        "fade-in-up": "fade-in-up 200ms cubic-bezier(0, 0, 0.2, 1) both",
        "pulse-dot": "pulse-dot 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "check-draw": "check-draw 400ms cubic-bezier(0, 0, 0.2, 1) 150ms forwards",
        "fill-pop": "fill-pop 220ms cubic-bezier(0.19, 1, 0.22, 1) both",
        "fill-out": "fill-out 220ms cubic-bezier(0.4, 0, 0.2, 1) 940ms forwards",
      },
    },
  },
  plugins: [],
};

export default config;
