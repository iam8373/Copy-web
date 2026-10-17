import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Staff } from "./auth";
import { AUDIT_COLUMNS, toAudit, type AuditRow } from "./read";

/**
 * R6 reads: users (admin only, through functions that check role + MFA in the
 * database and return emails), grievances, audit log, settings, compliance.
 */

export interface UserRow {
  id: string;
  email: string;
  handle: string;
  role: "user" | "moderator" | "admin";
  status: "active" | "suspended";
  created_at: string;
  age_confirmed_at: string | null;
  last_sign_in_at: string | null;
  balance: number | null;
}

export interface UserDetail extends UserRow {
  suspended_reason: string | null;
  suspended_at: string | null;
  terms_version: string | null;
  provider: string | null;
  mfa_factors: number;
  orders: number;
  recent_orders: Array<{
    id: string; side: "buy" | "sell"; amount: number; shares: number; avg_price: number;
    realized_pnl: number | null; created_at: string; market_slug: string; market_title: string; outcome: string;
  }>;
  ledger: Array<{ id: string; amount: number; type: string; note: string | null; created_at: string }>;
  positions: Array<{ market_slug: string; market_title: string; market_status: string; outcome: string; shares: number; avg_price: number }>;
  grievances: Array<{ id: string; reference: string; subject: string; status: string; created_at: string }>;
}

/** Staff session: the database function re-checks admin + MFA. */
export async function listUsers(_staff: Staff, search: string, page: number) {
  const { data, error } = await getServerSupabase({ readOnly: true }).rpc("admin_list_users", { p_search: search, p_page: page });
  if (error) return null;
  return data as unknown as { total: number; rows: UserRow[] };
}

export async function getUser(_staff: Staff, id: string): Promise<UserDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await getServerSupabase({ readOnly: true }).rpc("admin_user_detail", { p_user_id: id });
  if (error) return null;
  return data as unknown as UserDetail;
}

export type Compliance = {
  trading_enabled: boolean;
  two_person: boolean;
  dispute_window_hours: number;
  users: number;
  no_age_confirmation: number;
  suspended: number;
  terms_versions: Record<string, number>;
  grievances_open: number;
  grievances_unacknowledged_48h: number;
  grievances_over_30d: number;
  self_approved_30d: number;
  resolutions_30d: number;
  credits_adjusted_30d: number;
  staff: Array<{ id: string; email: string; role: string; status: string; mfa: boolean }>;
};

export async function getCompliance(_staff: Staff): Promise<Compliance | null> {
  const { data, error } = await getServerSupabase({ readOnly: true }).rpc("admin_compliance");
  if (error) return null;
  return data as unknown as Compliance;
}

export const GRIEVANCE_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type GrievanceStatus = (typeof GRIEVANCE_STATUSES)[number];

export interface Grievance {
  id: string;
  reference: string;
  category: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: GrievanceStatus;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  user_id: string | null;
  handler: string | null;
}

const G_COLUMNS =
  "id, reference, category, name, email, subject, message, status, admin_note, created_at, resolved_at, user_id, handler:profiles!grievances_handled_by_fkey(handle)";

type GDb = Omit<Grievance, "handler"> & { handler: { handle: string } | null };
const toG = (g: GDb): Grievance => ({ ...g, handler: g.handler?.handle ?? null });

/** Grievances are handled by moderators too (they contain contact details). */
export async function listGrievances(_staff: Staff, status: GrievanceStatus | "all", page: number) {
  let q = getAdminSupabase()
    .from("grievances")
    .select(G_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * 50, page * 50 - 1);
  if (status !== "all") q = q.eq("status", status);
  const { data, error, count } = await q;
  if (error) return null;
  return { total: count ?? 0, rows: (data as unknown as GDb[]).map(toG) };
}

export async function getGrievance(_staff: Staff, id: string): Promise<Grievance | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await getAdminSupabase().from("grievances").select(G_COLUMNS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return toG(data as unknown as GDb);
}

export async function listAudit(
  _staff: Staff,
  f: { action?: string; entity?: string; entityId?: string; page: number }
): Promise<{ rows: AuditRow[]; total: number } | null> {
  let q = getAdminSupabase()
    .from("audit_log")
    .select(AUDIT_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((f.page - 1) * 50, f.page * 50 - 1);
  const clean = (s?: string) => (s ?? "").replace(/[^a-z0-9_.-]/gi, "").slice(0, 64);
  if (clean(f.action)) q = q.like("action", `${clean(f.action)}%`);
  if (clean(f.entity)) q = q.eq("entity", clean(f.entity));
  if (clean(f.entityId)) q = q.eq("entity_id", clean(f.entityId));
  const { data, error, count } = await q;
  if (error) return null;
  return { total: count ?? 0, rows: (data as unknown as Parameters<typeof toAudit>[0][]).map(toAudit) };
}

export const SETTING_KEYS = [
  "trading_enabled",
  "min_trade",
  "max_trade",
  "signup_credit",
  "admin_credit_cap",
  "default_liquidity_b",
  "dispute_window_hours",
  "require_two_person_resolution",
  "staff_can_trade",
  "daily_translation_cap",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export async function getSettings(_staff: Staff) {
  const { data, error } = await getAdminSupabase()
    .from("app_settings")
    .select("key, value, updated_at, editor:profiles!app_settings_updated_by_fkey(handle)")
    .in("key", [...SETTING_KEYS]);
  if (error) return null;
  const rows = data as unknown as Array<{ key: SettingKey; value: unknown; updated_at: string; editor: { handle: string } | null }>;
  return SETTING_KEYS.map((k) => {
    const r = rows.find((x) => x.key === k);
    return { key: k, value: r?.value ?? null, updatedAt: r?.updated_at ?? null, editor: r?.editor?.handle ?? null };
  });
}
