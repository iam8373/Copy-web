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
        accent: {
          green: "#00C853",
          red: "#FF3B30",
          blue: "#3B82F6",
          yellow: "#FFB300",
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
      },
    },
  },
  plugins: [],
};

export default config;
