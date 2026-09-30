import localFont from "next/font/local";

/**
 * Self-hosted fonts (Phase 2). Nothing is fetched from Google at build or run
 * time. Files were copied from the @fontsource packages listed in README.md.
 *
 * Inter is the UI font for every locale, so it is preloaded. The Indic
 * families are `preload: false` and are only referenced by CSS under
 * `html[data-script=...]` (see globals.css), so a browser showing a Latin
 * locale never requests them.
 */
export const inter = localFont({
  src: [
    { path: "./inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  preload: true,
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial"],
});

export const notoDevanagari = localFont({
  src: [
    { path: "./noto-sans-devanagari-devanagari-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./noto-sans-devanagari-devanagari-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-devanagari",
  display: "swap",
  preload: false,
});

export const notoBengali = localFont({
  src: [
    { path: "./noto-sans-bengali-bengali-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./noto-sans-bengali-bengali-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-bengali",
  display: "swap",
  preload: false,
});

export const notoTamil = localFont({
  src: [
    { path: "./noto-sans-tamil-tamil-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./noto-sans-tamil-tamil-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-tamil",
  display: "swap",
  preload: false,
});

export const notoTelugu = localFont({
  src: [
    { path: "./noto-sans-telugu-telugu-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./noto-sans-telugu-telugu-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-telugu",
  display: "swap",
  preload: false,
});

export const fontVariables = [
  inter.variable,
  notoDevanagari.variable,
  notoBengali.variable,
  notoTamil.variable,
  notoTelugu.variable,
].join(" ");
