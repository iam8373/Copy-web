import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          tertiary: "var(--bg-tertiary)",
        },
        subtle: "var(--border-subtle)",
        content: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
        },
        // Distinct house palette: violet primary with an emerald/rose pair.
        accent: {
          green: "#16C784",
          red: "#F6465D",
          blue: "#7C5CFF",
          strong: "#6A46F5",
          yellow: "#F7A83B",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "12px",
        lg: "8px",
      },
      keyframes: {
        "flash-up": {
          "0%, 100%": { color: "inherit" },
          "20%": { color: "#00C853" },
        },
        "flash-down": {
          "0%, 100%": { color: "inherit" },
          "20%": { color: "#FF3B30" },
        },
        "slide-up": {
          from: { transform: "translateY(16px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // Phase A: order-confirmation success animation.
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
        "flash-up": "flash-up 900ms ease-out",
        "flash-down": "flash-down 900ms ease-out",
        "slide-up": "slide-up 220ms ease-out",
        "fade-in": "fade-in 160ms ease-out",
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
        "check-draw": "check-draw 420ms ease-out 120ms forwards",
        "fill-pop": "fill-pop 200ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "fill-out": "fill-out 220ms ease-in 940ms forwards",
      },
    },
  },
  plugins: [],
};

export default config;
