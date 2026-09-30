import { DICTIONARIES } from "@/i18n";
import type { Dictionary } from "@/i18n";
import type { TargetLocale } from "./types";

/**
 * Protected terminology. These words must read identically everywhere, so
 * their renderings come from the existing UI dictionaries (`terms` section),
 * never from the model. The prompt tells the model to use exactly these
 * forms, and validate.ts rejects output that does not.
 *
 * `caseSensitive` terms are outcome labels: "Yes"/"No" as capitalised labels,
 * not the everyday English words "yes"/"no".
 */
export const PROTECTED_TERMS: ReadonlyArray<{
  key: keyof Dictionary["terms"];
  caseSensitive: boolean;
}> = [
  { key: "yes", caseSensitive: true },
  { key: "no", caseSensitive: true },
  { key: "buy", caseSensitive: false },
  { key: "sell", caseSensitive: false },
  { key: "probability", caseSensitive: false },
  { key: "volume", caseSensitive: false },
  { key: "marketCloses", caseSensitive: false },
  { key: "resolves", caseSensitive: false },
  { key: "liquidity", caseSensitive: false },
  { key: "position", caseSensitive: false },
];

/** { english, rendering } for each protected term, for one locale. */
export function termsFor(locale: TargetLocale) {
  const en = DICTIONARIES.en.terms;
  const loc = DICTIONARIES[locale].terms;
  return PROTECTED_TERMS.map((t) => ({
    key: t.key,
    english: en[t.key],
    rendering: loc[t.key],
    caseSensitive: t.caseSensitive,
  }));
}

/**
 * Proper nouns and acronyms the model must keep in their common written form.
 * Not exhaustive — team and person names are covered by the general rule in
 * the prompt — but these are the ones most often mangled.
 */
export const PROPER_NOUNS = [
  "IPL",
  "BCCI",
  "ICC",
  "RBI",
  "SEBI",
  "NSE",
  "BSE",
  "MCX",
  "NPCI",
  "UPI",
  "GDP",
  "CPI",
  "BJP",
  "AAP",
  "NDA",
  "INDIA alliance",
  "Congress",
  "Nifty",
  "Nifty 50",
  "Sensex",
  "Lok Sabha",
  "Rajya Sabha",
  "Bigg Boss",
  "BGMI",
  "Valorant",
  "ISL",
] as const;
