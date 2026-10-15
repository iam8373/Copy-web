import "server-only";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { MarketStatus } from "@/lib/admin/market-schema";
import type { Staff } from "./auth";
import { AUDIT_COLUMNS, toAudit, type AuditRow } from "./read";

/** Admin market reads (R3). Secret key, after requireStaff (see read.ts). */

export const STATUSES: MarketStatus[] = ["draft", "open", "closed", "resolving", "resolved", "voided"];
export const PAGE_SIZE = 50;

export interface AdminMarketRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: MarketStatus;
  endDate: string;
  totalVolume: number;
  isLive: boolean;
  isFeatured: boolean;
}

export interface AdminMarket extends AdminMarketRow {
  description: string;
  subcategory: string;
  resolutionSource: string;
  isBinary: boolean;
  liquidityB: number;
  tags: string[];
  region: string;
  resolvedOutcomeId: string | null;
  outcomes: Array<{ id: string; label: string; price: number }>;
  history: AuditRow[];
}

/** Escapes PostgREST ilike wildcards and filter syntax in a search term. */
const term = (q: string) => q.replace(/[%_\\,()*]/g, " ").trim().slice(0, 80);

export async function listMarkets(
  _staff: Staff,
  opts: { status?: MarketStatus; q?: string; page?: number }
): Promise<{ rows: AdminMarketRow[]; total: number } | null> {
  const page = Math.max(1, opts.page ?? 1);
  let query = getAdminSupabase()
    .from("markets")
    .select("id, slug, title, category, status, end_date, total_volume, is_live, is_featured", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (opts.status) query = query.eq("status", opts.status);
  const q = term(opts.q ?? "");
  if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
  const { data, error, count } = await query;
  if (error) return null;
  return {
    total: count ?? 0,
    rows: data.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      category: r.category,
      status: r.status as MarketStatus,
      endDate: r.end_date,
      totalVolume: Number(r.total_volume),
      isLive: r.is_live,
      isFeatured: r.is_featured,
    })),
  };
}

export async function getAdminMarket(_staff: Staff, id: string): Promise<AdminMarket | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = getAdminSupabase();
  const [m, h] = await Promise.all([
    db
      .from("markets")
      .select("*, outcomes!outcomes_market_id_fkey(id, label, price, sort_order)")
      .eq("id", id)
      .maybeSingle(),
    db.from("audit_log").select(AUDIT_COLUMNS).eq("entity", "market").eq("entity_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (m.error || !m.data) return null;
  const r = m.data as typeof m.data & { outcomes: Array<{ id: string; label: string; price: number; sort_order: number }> };
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    category: r.category,
    status: r.status as MarketStatus,
    endDate: r.end_date,
    totalVolume: Number(r.total_volume),
    isLive: r.is_live,
    isFeatured: r.is_featured,
    description: r.description,
    subcategory: r.subcategory,
    resolutionSource: r.resolution_source,
    isBinary: r.is_binary,
    liquidityB: Number(r.liquidity_b),
    tags: r.tags ?? [],
    region: r.region,
    resolvedOutcomeId: r.resolved_outcome_id,
    outcomes: [...r.outcomes].sort((a, b) => a.sort_order - b.sort_order).map((o) => ({ id: o.id, label: o.label, price: Number(o.price) })),
    history: ((h.data ?? []) as unknown as Parameters<typeof toAudit>[0][]).map(toAudit),
  };
}

export async function defaultLiquidity(): Promise<number> {
  const { data } = await getAdminSupabase().from("app_settings").select("value").eq("key", "default_liquidity_b").maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n > 0 ? n : 20000;
}
