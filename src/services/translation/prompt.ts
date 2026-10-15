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

/** Outcome labels (R5): short names, kept in order, one array per locale. */
export function outcomesSystemPrompt(): string {
  const yesNo = TARGET_LOCALES.map((l) => {
    const t = termsFor(l).filter((x) => x.key === "yes" || x.key === "no");
    return `- ${l}: ${t.map((x) => `"${x.english}" -> "${x.rendering}"`).join("; ")}`;
  }).join("\n");
  return [
    "You translate the answer options (outcome labels) of a prediction market for an Indian audience.",
    `Translate every label into: ${TARGET_LOCALES.map((l) => `${l} = ${LOCALE_NAMES[l]}`).join(", ")}.`,
    "",
    "Rules:",
    "1. Return the labels in the same order and the same number as given.",
    "2. Keep numbers, percentages, ₹ amounts and all-caps acronyms exactly as written, with Latin digits.",
    "3. Team, party, person and place names: the common written form a native newspaper uses (transliterate into the script).",
    "4. Keep each label short; do not explain or add words.",
    "5. The labels Yes and No must be rendered exactly as:",
    yesNo,
    "6. Output only the JSON object described by the schema.",
  ].join("\n");
}

export function outcomesUserPrompt(labels: string[]): string {
  return JSON.stringify({ labels });
}

export function outcomesResponseSchema(n: number) {
  const list = { type: "array", minItems: n, maxItems: n, items: { type: "string" } };
  return {
    type: "object",
    additionalProperties: false,
    required: [...TARGET_LOCALES],
    properties: Object.fromEntries(TARGET_LOCALES.map((l) => [l, list])),
  };
}
