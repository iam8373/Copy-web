"use client";

import { useMemo } from "react";
import translations from "@/data/market-translations.json";
import { sourceHashFor } from "@/services/translation/hash";
import type {
  TargetLocale,
  TranslationFile,
} from "@/services/translation/types";
import { TARGET_LOCALES } from "@/services/translation/types";
import { useT } from "@/i18n/LanguageProvider";
import type { Locale } from "@/i18n";
import type { Market } from "@/lib/types";

/**
 * Phase 6 runtime: READ-ONLY access to translations saved in
 * src/data/market-translations.json. There are no AI calls here or anywhere
 * in the app; translations are produced offline by `npm run translate:markets`.
 *
 * Falls back to the English original when the locale is English, the market
 * has no entry, the entry lacks that locale, or the entry is stale (its
 * sourceHash no longer matches the current title/description/subcategory).
 */
const FILE = translations as TranslationFile;

// Cache hashes by the exact source text, NOT by market id: an id-keyed cache
// would keep serving a translation after the market's text changed.
const hashCache = new Map<string, string>();
function currentHash(m: Pick<Market, "title" | "description" | "subcategory">) {
  const key = `${m.title}\n${m.description}\n${m.subcategory}`;
  let h = hashCache.get(key);
  if (!h) {
    h = sourceHashFor(m);
    hashCache.set(key, h);
  }
  return h;
}

export interface MarketText {
  title: string;
  description: string;
  /** True only when saved, fresh, non-English text is being shown. */
  translated: boolean;
  status?: "machine-drafted" | "reviewed";
}

export function getMarketText(
  market: Pick<Market, "id" | "title" | "description" | "subcategory">,
  locale: Locale
): MarketText {
  const english: MarketText = {
    title: market.title,
    description: market.description,
    translated: false,
  };
  if (!(TARGET_LOCALES as readonly string[]).includes(locale)) return english;

  const entry = FILE[market.id];
  if (!entry || entry.sourceHash !== currentHash(market)) return english;

  const loc = entry.locales?.[locale as TargetLocale];
  if (!loc || typeof loc.title !== "string" || !loc.title.trim()) return english;

  return {
    title: loc.title,
    description: typeof loc.description === "string" && loc.description.trim() ? loc.description : market.description,
    translated: true,
    status: entry.status,
  };
}

/** Hook form for client components; follows the active UI language. */
export function useMarketText(
  market: Pick<Market, "id" | "title" | "description" | "subcategory">
): MarketText {
  const { locale } = useT();
  return useMemo(() => getMarketText(market, locale), [market, locale]);
}
