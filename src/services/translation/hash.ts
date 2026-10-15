import { sha256Hex } from "@/lib/sha256";
import type { MarketSource } from "./types";

/**
 * The hash that decides whether a saved translation is still valid. Any change
 * to the title, description or subcategory makes the saved entry stale.
 * Shared by the script (writer) and market-text.ts (reader).
 */
export function sourceHashFor(m: Pick<MarketSource, "title" | "description" | "subcategory">) {
  return sha256Hex(`${m.title}\n${m.description}\n${m.subcategory}`);
}

/** Outcome labels: sha256 of the English label (outcome_source_hash() in SQL). */
export function outcomeHashFor(label: string) {
  return sha256Hex(label);
}
