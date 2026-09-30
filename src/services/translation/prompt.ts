import { PROPER_NOUNS, termsFor } from "./glossary";
import { TARGET_LOCALES, type MarketSource } from "./types";

const LOCALE_NAMES: Record<(typeof TARGET_LOCALES)[number], string> = {
  hi: "Hindi (Devanagari)",
  mr: "Marathi (Devanagari)",
  bn: "Bengali (Bengali script)",
  ta: "Tamil (Tamil script)",
  te: "Telugu (Telugu script)",
};

/** System prompt: the rules. Kept separate so it can be reviewed on its own. */
export function systemPrompt(): string {
  const glossary = TARGET_LOCALES.map((l) => {
    const rows = termsFor(l)
      .map((t) => `"${t.english}" -> "${t.rendering}"`)
      .join("; ");
    return `- ${l}: ${rows}`;
  }).join("\n");

  return [
    "You translate prediction-market listings for an Indian audience.",
    `Translate the market title and description into: ${TARGET_LOCALES.map((l) => `${l} = ${LOCALE_NAMES[l]}`).join(", ")}.`,
    "",
    "Rules:",
    "1. Keep every number, percentage, date, year, ticker and the ₹ symbol exactly as written, using Latin digits. Do not convert, round, or respell them.",
    "2. Keep all-caps acronyms and tickers (for example T20, FY27, GDP, MCX) exactly as written in Latin letters.",
    `3. Keep proper nouns in their common written form. In particular: ${PROPER_NOUNS.join(", ")}. Team, person, place and event names may be transliterated into the target script, as a native newspaper would.`,
    "4. Do not add or remove information. Do not change what makes the market resolve Yes or No, or when.",
    "5. Do not give financial advice, predictions or opinions.",
    "6. Keep the title concise; it must stay a single line.",
    "7. Protected terms: when the source uses one of these words, render it exactly as given (do not choose your own translation):",
    glossary,
    "8. Output only the JSON object described by the schema.",
  ].join("\n");
}

/** User message: the data. The subcategory is context only; it is not translated. */
export function userPrompt(m: MarketSource): string {
  return JSON.stringify({
    context: { subcategory: m.subcategory },
    title: m.title,
    description: m.description,
  });
}

/** Strict JSON schema: all five locales, each exactly { title, description }. */
export function responseSchema() {
  const text = {
    type: "object",
    additionalProperties: false,
    required: ["title", "description"],
    properties: { title: { type: "string" }, description: { type: "string" } },
  };
  return {
    type: "object",
    additionalProperties: false,
    required: [...TARGET_LOCALES],
    properties: Object.fromEntries(TARGET_LOCALES.map((l) => [l, text])),
  };
}
