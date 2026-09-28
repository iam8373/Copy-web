import en, { type Dictionary } from "./en";
import hi from "./hi";
import mr from "./mr";
import bn from "./bn";

export const LOCALES = ["en", "hi", "mr", "bn", "ta", "te"] as const;
export type Locale = (typeof LOCALES)[number];

/** Native label shown in the picker, plus the script each locale needs. */
export const LOCALE_META: Record<Locale, { label: string; script: Script }> = {
  en: { label: "English", script: "latin" },
  hi: { label: "हिन्दी", script: "devanagari" },
  mr: { label: "मराठी", script: "devanagari" },
  bn: { label: "বাংলা", script: "bengali" },
  ta: { label: "தமிழ்", script: "tamil" },
  te: { label: "తెలుగు", script: "telugu" },
};

export type Script = "latin" | "devanagari" | "bengali" | "tamil" | "telugu";

/**
 * Locales added in E2 fall back to English until their dictionary lands, which
 * is exactly the documented fallback behaviour rather than a missing-key crash.
 */
export const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  hi,
  mr,
  bn,
  ta: en,
  te: en,
};

export const STORAGE_KEY = "bp-lang";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export type { Dictionary };
export { en };

/** Maps a category slug to its nav dictionary key. */
export const NAV_KEY_BY_SLUG = {
  live: "live",
  cricket: "cricket",
  politics: "politics",
  entertainment: "entertainment",
  economy: "economy",
  finance: "finance",
  sports: "sports",
  esports: "esports",
  tech: "tech",
  "world-news": "worldNews",
  war: "war",
  ai: "ai",
} as const;
