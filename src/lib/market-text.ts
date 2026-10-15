"use client";

import { useMemo } from "react";
import { outcomeHashFor, sourceHashFor } from "@/services/translation/hash";
import { TARGET_LOCALES } from "@/services/translation/types";
import { useT } from "@/i18n/LanguageProvider";
import type { Locale } from "@/i18n";
import type { Market, Outcome } from "@/lib/types";

/**
 * READ-ONLY access to saved translations, which arrive with each market from
 * the database (market_translations, B3). There are no AI calls here or
 * anywhere in the app at page-view time; translations are made once, offline.
 *
 * Falls back to the English original when the locale is English, the market
 * has no entry, the entry lacks that locale, or the entry is stale (its
 * sourceHash no longer matches the current title/description/subcategory).
 */
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
  market: Pick<Market, "id" | "title" | "description" | "subcategory" | "translations">,
  locale: Locale
): MarketText {
  const english: MarketText = {
    title: market.title,
    description: market.description,
    translated: false,
  };
  if (!(TARGET_LOCALES as readonly string[]).includes(locale)) return english;

  const loc = market.translations?.[locale];
  if (!loc || loc.sourceHash !== currentHash(market)) return english;
  if (typeof loc.title !== "string" || !loc.title.trim()) return english;

  return {
    title: loc.title,
    description: typeof loc.description === "string" && loc.description.trim() ? loc.description : market.description,
    translated: true,
    status: loc.status,
  };
}

/** Hook form for client components; follows the active UI language. */
export function useMarketText(
  market: Pick<Market, "id" | "title" | "description" | "subcategory" | "translations">
): MarketText {
  const { locale } = useT();
  return useMemo(() => getMarketText(market, locale), [market, locale]);
}

const labelHashCache = new Map<string, string>();

/**
 * An outcome's label in `locale`: the saved translation while it still
 * matches the English label (hash), otherwise the English label (R5).
 */
export function getOutcomeLabel(o: Pick<Outcome, "label" | "translations">, locale: Locale): string {
  if (!(TARGET_LOCALES as readonly string[]).includes(locale)) return o.label;
  const saved = o.translations?.[locale];
  if (!saved?.label?.trim()) return o.label;
  let h = labelHashCache.get(o.label);
  if (!h) {
    h = outcomeHashFor(o.label);
    labelHashCache.set(o.label, h);
  }
  return saved.sourceHash === h ? saved.label : o.label;
}

/** Hook: `label(outcome)` in the active UI language. */
export function useOutcomeLabel(): (o: Pick<Outcome, "label" | "translations">) => string {
  const { locale } = useT();
  return useMemo(() => (o: Pick<Outcome, "label" | "translations">) => getOutcomeLabel(o, locale), [locale]);
}
