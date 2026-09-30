import { readFileSync, writeFileSync } from "node:fs";
import { sourceHashFor } from "./hash";
import type { MarketSource, TranslationFile } from "./types";

/** Node-only file helpers used by the script and CI. */

export const DEFAULT_TRANSLATIONS_PATH = "src/data/market-translations.json";

export function readTranslations(path: string): TranslationFile {
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${path} must contain a JSON object`);
    }
    return parsed as TranslationFile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

/** Stable output: keys sorted by market id, two-space indent, trailing newline. */
export function writeTranslations(path: string, file: TranslationFile) {
  const sorted = Object.fromEntries(Object.keys(file).sort().map((k) => [k, file[k]]));
  writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

export type WorkReason = "missing" | "stale";

export interface WorkItem {
  market: MarketSource;
  reason: WorkReason;
  hash: string;
}

/**
 * Which markets need a (re)translation. Rules:
 * - no entry -> "missing"
 * - entry whose sourceHash differs from the current text -> "stale"
 *   (this applies to "reviewed" entries too: the reviewed text no longer
 *   matches the source, so it must be redone and reviewed again)
 * - entry with a matching hash -> nothing to do, whatever its status.
 *   In particular a "reviewed" entry is never overwritten unless the source
 *   changed.
 */
export function planWork(markets: MarketSource[], file: TranslationFile): WorkItem[] {
  const out: WorkItem[] = [];
  for (const market of markets) {
    const hash = sourceHashFor(market);
    const entry = file[market.id];
    if (!entry) out.push({ market, reason: "missing", hash });
    else if (entry.sourceHash !== hash) out.push({ market, reason: "stale", hash });
  }
  return out;
}
