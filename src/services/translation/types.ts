/**
 * Shapes for stored market translations (Phase 6). This file is safe to import
 * anywhere; it holds types and constants only.
 */
export const TARGET_LOCALES = ["hi", "mr", "bn", "ta", "te"] as const;
export type TargetLocale = (typeof TARGET_LOCALES)[number];

export interface LocalizedText {
  title: string;
  description: string;
}

export type TranslationStatus = "machine-drafted" | "reviewed";

export interface TranslationEntry {
  /** sha256 of title + "\n" + description + "\n" + subcategory (see sourceHashFor). */
  sourceHash: string;
  translatedAt: string;
  status: TranslationStatus;
  locales: Record<TargetLocale, LocalizedText>;
}

/** Keyed by market id. */
export type TranslationFile = Record<string, TranslationEntry>;

/** The fields a translation is derived from. */
export interface MarketSource {
  id: string;
  title: string;
  description: string;
  subcategory: string;
}
