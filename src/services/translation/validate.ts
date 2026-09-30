import { PROTECTED_TERMS, termsFor } from "./glossary";
import {
  TARGET_LOCALES,
  type LocalizedText,
  type MarketSource,
  type TargetLocale,
  type TranslationEntry,
} from "./types";

/**
 * Deterministic checks on a model's output. Anything that fails leaves the
 * market in English. Pure functions: safe for CI (no API key, no network).
 */

/** All-caps tokens such as IPL, T20, GPT-6, FY2026-27. Must survive verbatim. */
const TICKER = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\b/g;
/** ₹ amounts such as ₹1,20,000. */
const RUPEE = /₹\s?\d(?:[\d,]*\d)?(?:\.\d+)?/g;
/** Numbers, including Indian grouping, decimals and percentages. */
const NUMBER = /\d(?:[\d,]*\d)?(?:\.\d+)?%?/g;

function tickers(text: string): string[] {
  return (text.match(TICKER) ?? []).filter(
    // At least two chars, and at least one letter (so "7" alone is not a ticker).
    (t) => t.length >= 2 && /[A-Z]/.test(t)
  );
}

/** Numbers that are not part of a ticker (FY27's 27 belongs to the ticker). */
function numbers(text: string): string[] {
  const stripped = text.replace(TICKER, (t) => (t.length >= 2 && /[A-Z]/.test(t) ? " " : t));
  return stripped.match(NUMBER) ?? [];
}

function rupees(text: string): string[] {
  return (text.match(RUPEE) ?? []).map((r) => r.replace(/\s/g, ""));
}

/** Consecutive runs of 3 lowercase English words, e.g. "declared winners of". */
function lowercaseTrigrams(text: string): string[] {
  const words = text.split(/[^A-Za-z']+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i + 2 < words.length; i++) {
    const run = words.slice(i, i + 3);
    // Capitalised words are proper nouns and allowed to stay in English.
    if (run.every((w) => /^[a-z]/.test(w))) out.push(run.join(" ").toLowerCase());
  }
  return out;
}

function hasWord(text: string, word: string, caseSensitive: boolean) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, caseSensitive ? "" : "i").test(text);
}

export interface FieldProblem {
  locale: TargetLocale;
  field: keyof LocalizedText;
  problem: string;
}

/** Checks one translated field against its English source. */
export function checkField(
  locale: TargetLocale,
  field: keyof LocalizedText,
  source: string,
  output: unknown
): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const p = (problem: string) => problems.push({ locale, field, problem });

  if (typeof output !== "string" || output.trim() === "") {
    p("empty or not a string");
    return problems;
  }
  if (output.length > source.length * 2) p(`longer than 2x the source (${output.length} > ${source.length * 2})`);
  if (output.trim() === source.trim()) p("identical to the English source");

  for (const t of tickers(source)) if (!output.includes(t)) p(`ticker "${t}" missing or altered`);
  for (const r of rupees(source)) if (!rupees(output).includes(r)) p(`amount "${r}" missing or altered`);

  const srcNums = numbers(source);
  const outNums = numbers(output);
  for (const n of srcNums) if (!outNums.includes(n)) p(`number "${n}" missing or altered`);
  for (const n of outNums) if (!srcNums.includes(n)) p(`number "${n}" not in the source (added or altered)`);

  const lowerOut = output.toLowerCase();
  const leftover = lowercaseTrigrams(source).find((g) => lowerOut.includes(g));
  if (leftover) p(`contains untranslated English "${leftover}"`);

  for (const term of termsFor(locale)) {
    const def = PROTECTED_TERMS.find((t) => t.key === term.key)!;
    if (hasWord(source, term.english, def.caseSensitive) && !output.includes(term.rendering)) {
      p(`protected term "${term.english}" must be rendered as "${term.rendering}"`);
    }
  }
  return problems;
}

/**
 * Validates a model response (or a stored entry's `locales`) for one market.
 * Also enforces the exact JSON shape: all five locales, each with exactly
 * { title, description }, nothing extra.
 */
export function validateLocales(source: MarketSource, locales: unknown): FieldProblem[] {
  const problems: FieldProblem[] = [];
  if (typeof locales !== "object" || locales === null || Array.isArray(locales)) {
    return TARGET_LOCALES.map((l) => ({ locale: l, field: "title" as const, problem: "response is not an object" }));
  }
  const obj = locales as Record<string, unknown>;
  const extra = Object.keys(obj).filter((k) => !(TARGET_LOCALES as readonly string[]).includes(k));
  for (const k of extra) {
    problems.push({ locale: "hi", field: "title", problem: `unexpected locale key "${k}"` });
  }

  for (const locale of TARGET_LOCALES) {
    const entry = obj[locale];
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      problems.push({ locale, field: "title", problem: "locale missing or not an object" });
      continue;
    }
    const fields = Object.keys(entry);
    if (fields.length !== 2 || !fields.includes("title") || !fields.includes("description")) {
      problems.push({ locale, field: "title", problem: `expected exactly {title, description}, got {${fields.join(", ")}}` });
    }
    const e = entry as Record<string, unknown>;
    problems.push(...checkField(locale, "title", source.title, e.title));
    problems.push(...checkField(locale, "description", source.description, e.description));
  }
  return problems;
}

/** Validates a stored entry's metadata as well as its text. */
export function validateEntry(
  source: MarketSource,
  entry: TranslationEntry,
  expectedHash: string
): string[] {
  const out: string[] = [];
  if (!/^[0-9a-f]{64}$/.test(entry.sourceHash)) out.push("sourceHash is not a sha256 hex digest");
  else if (entry.sourceHash !== expectedHash) out.push("sourceHash is stale (source text changed)");
  if (Number.isNaN(Date.parse(entry.translatedAt))) out.push("translatedAt is not an ISO date");
  if (entry.status !== "machine-drafted" && entry.status !== "reviewed") out.push(`bad status "${entry.status}"`);
  for (const p of validateLocales(source, entry.locales)) out.push(`${p.locale}.${p.field}: ${p.problem}`);
  return out;
}
