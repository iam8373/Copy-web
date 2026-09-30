/**
 * npm run validate:translations — offline, no API key, no network.
 *
 * 1. Every locale dictionary has exactly the same keys as en.ts.
 * 2. Every entry in src/data/market-translations.json refers to a real
 *    market, has a fresh sourceHash, and passes validate.ts.
 */
import { resolve } from "node:path";
import { DICTIONARIES, LOCALES } from "../src/i18n";
import { MARKETS } from "../src/data/markets";
import { sourceHashFor } from "../src/services/translation/hash";
import { DEFAULT_TRANSLATIONS_PATH, readTranslations } from "../src/services/translation/store";
import { validateEntry } from "../src/services/translation/validate";

function flatKeys(dict: Record<string, Record<string, string>>) {
  return Object.entries(dict)
    .flatMap(([s, e]) => Object.keys(e).map((k) => `${s}.${k}`))
    .sort();
}

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};

console.log("Locale key parity");
const enKeys = flatKeys(DICTIONARIES.en as never);
for (const l of LOCALES) {
  if (l === "en") continue;
  const keys = flatKeys(DICTIONARIES[l] as never);
  const missing = enKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !enKeys.includes(k));
  if (DICTIONARIES[l] === DICTIONARIES.en) fail(`${l} aliases English instead of shipping a dictionary`);
  if (missing.length) fail(`${l} missing: ${missing.join(", ")}`);
  if (extra.length) fail(`${l} extra: ${extra.join(", ")}`);
  if (!missing.length && !extra.length) console.log(`  ✓ ${l} (${keys.length} keys)`);
}

console.log("Stored market translations");
const file = readTranslations(resolve(DEFAULT_TRANSLATIONS_PATH));
for (const [id, entry] of Object.entries(file)) {
  const market = MARKETS.find((m) => m.id === id);
  if (!market) {
    fail(`${id}: no such market`);
    continue;
  }
  const problems = validateEntry(market, entry, sourceHashFor(market));
  if (problems.length) problems.forEach((p) => fail(`${id}: ${p}`));
  else console.log(`  ✓ ${id} (${entry.status})`);
}

if (failures) {
  console.log(`\n${failures} problem(s).`);
  process.exit(1);
}
console.log("\nAll translations valid.");
