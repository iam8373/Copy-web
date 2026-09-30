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
