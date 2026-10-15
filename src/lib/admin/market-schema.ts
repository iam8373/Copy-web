import { z } from "zod";
import type { Category } from "@/lib/types";

/**
 * Admin market form schema (R3). Pure (no server-only) so the form, the
 * Server Actions and node-level tests share it. The database re-validates
 * everything (admin_create_market / admin_update_market).
 */

export const CATEGORY_VALUES = [
  "cricket", "politics", "entertainment", "economy", "finance",
  "sports", "esports", "tech", "world-news", "war", "ai",
] as const satisfies readonly Category[];

export type MarketStatus = "draft" | "open" | "closed" | "resolving" | "resolved" | "voided";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const MarketFields = z.object({
  slug: z.string().trim().min(3).max(96).regex(SLUG, "lowercase words joined by hyphens"),
  title: z.string().trim().min(3).max(200),
  description: z.string().max(4000),
  category: z.enum(CATEGORY_VALUES),
  subcategory: z.string().trim().min(1).max(60),
  endDate: z.string().datetime({ offset: true }),
  resolutionSource: z.string().trim().max(300),
  isBinary: z.boolean(),
  outcomes: z.array(z.string().trim().min(1).max(80)).max(20),
  liquidityB: z.number().min(100).max(10_000_000),
  isFeatured: z.boolean(),
  isLive: z.boolean(),
  tags: z.array(z.string().trim().toLowerCase().max(40).regex(SLUG)).max(20),
  region: z.string().trim().min(1).max(40),
});

export type MarketInput = z.infer<typeof MarketFields>;

const distinct = (xs: string[]) => new Set(xs.map((x) => x.toLowerCase())).size === xs.length;

export const CreateMarket = MarketFields.superRefine((v, ctx) => {
  if (!v.isBinary && (v.outcomes.length < 3 || !distinct(v.outcomes))) {
    ctx.addIssue({ code: "custom", path: ["outcomes"], message: "3–20 distinct outcomes" });
  }
  if (Date.parse(v.endDate) <= Date.now()) ctx.addIssue({ code: "custom", path: ["endDate"], message: "must be in the future" });
});

export const UpdateMarket = MarketFields.partial().superRefine((v, ctx) => {
  if (v.outcomes && v.isBinary === false && (v.outcomes.length < 3 || !distinct(v.outcomes))) {
    ctx.addIssue({ code: "custom", path: ["outcomes"], message: "3–20 distinct outcomes" });
  }
});

/** Fields admin_update_market accepts per status (mirrors the database). */
export function editableFields(status: MarketStatus): Set<keyof MarketInput> {
  const words: Array<keyof MarketInput> = ["title", "description", "subcategory", "resolutionSource", "isFeatured", "isLive"];
  const tags: Array<keyof MarketInput> = ["tags", "region"];
  if (status === "draft") return new Set(Object.keys(MarketFields.shape) as Array<keyof MarketInput>);
  if (status === "open") return new Set<keyof MarketInput>([...words, ...tags, "endDate"]);
  if (status === "closed") return new Set<keyof MarketInput>([...words, ...tags]);
  if (status === "resolving") return new Set(tags);
  return new Set<keyof MarketInput>();
}

/** camelCase form fields → the snake_case jsonb the database functions take. */
export function toDbPayload(v: Partial<MarketInput>): Record<string, unknown> {
  const map: Record<string, string> = {
    slug: "slug", title: "title", description: "description", category: "category", subcategory: "subcategory",
    endDate: "end_date", resolutionSource: "resolution_source", isBinary: "is_binary", outcomes: "outcomes",
    liquidityB: "liquidity_b", isFeatured: "is_featured", isLive: "is_live",
  };
  const out: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(map)) {
    const val = v[k as keyof MarketInput];
    if (val !== undefined) out[col] = val;
  }
  return out;
}

/** <input type="datetime-local"> values are India time (IST, UTC+05:30). */
export function istLocalToIso(local: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return "";
  return new Date(`${local}:00+05:30`).toISOString();
}

export function isoToIstLocal(iso: string): string {
  const t = new Date(new Date(iso).getTime() + 330 * 60 * 1000);
  return t.toISOString().slice(0, 16);
}
