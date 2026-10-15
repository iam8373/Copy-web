import "server-only";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Staff } from "./auth";

/**
 * Admin reads (R2+). Run on the server with the secret key AFTER
 * requireStaff(): there is deliberately no "staff can read everything" RLS
 * policy. Every function takes the verified Staff so a call site cannot
 * forget the check. Writes never go through here (see action.ts).
 */

export interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actor: string | null;
  createdAt: string;
  before: unknown;
  after: unknown;
}

export interface Dashboard {
  tradingEnabled: boolean;
  counts: Record<"open" | "closingSoon" | "drafts" | "awaiting" | "pending" | "inWindow" | "grievances" | "users" | "suspended", number>;
  windows: Array<{ id: string; slug: string; title: string; endsAt: string; selfApproved: boolean }>;
  audit: AuditRow[];
}

type AuditDb = {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
  before: unknown;
  after: unknown;
  profiles: { handle: string } | null;
};

export const toAudit = (r: AuditDb): AuditRow => ({
  id: r.id,
  action: r.action,
  entity: r.entity,
  entityId: r.entity_id,
  actor: r.profiles?.handle ?? null,
  createdAt: r.created_at,
  before: r.before,
  after: r.after,
});

export const AUDIT_COLUMNS = "id, action, entity, entity_id, created_at, before, after, profiles(handle)";

export async function getDashboard(_staff: Staff): Promise<Dashboard | null> {
  const db = getAdminSupabase();
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  const count = (q: PromiseLike<{ count: number | null; error: unknown }>) =>
    Promise.resolve(q).then((r) => (r.error ? Promise.reject(r.error) : r.count ?? 0));
  const markets = () => db.from("markets").select("id", { count: "exact", head: true });
  try {
    const [open, closingSoon, drafts, closed, expiredOpen, pending, inWindow, grievances, users, suspended, setting, windows, audit] =
      await Promise.all([
        count(markets().eq("status", "open")),
        count(markets().eq("status", "open").gt("end_date", now.toISOString()).lte("end_date", soon)),
        count(markets().eq("status", "draft")),
        count(markets().eq("status", "closed")),
        count(markets().eq("status", "open").lte("end_date", now.toISOString())),
        count(db.from("resolution_proposals").select("id", { count: "exact", head: true }).eq("status", "pending")),
        count(db.from("resolution_proposals").select("id", { count: "exact", head: true }).eq("status", "approved")),
        count(db.from("grievances").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"])),
        count(db.from("profiles").select("id", { count: "exact", head: true })),
        count(db.from("profiles").select("id", { count: "exact", head: true }).eq("status", "suspended")),
        db.from("app_settings").select("value").eq("key", "trading_enabled").maybeSingle(),
        db
          .from("resolution_proposals")
          .select("id, dispute_ends_at, self_approved, markets!inner(slug, title)")
          .eq("status", "approved")
          .order("dispute_ends_at", { ascending: true })
          .limit(10),
        db.from("audit_log").select(AUDIT_COLUMNS).order("created_at", { ascending: false }).limit(10),
      ]);
    if (windows.error || audit.error) return null;
    return {
      tradingEnabled: setting.data?.value === true,
      counts: { open, closingSoon, drafts, awaiting: closed + expiredOpen, pending, inWindow, grievances, users, suspended },
      windows: (windows.data as unknown as Array<{ id: string; dispute_ends_at: string; self_approved: boolean; markets: { slug: string; title: string } }>).map(
        (w) => ({ id: w.id, slug: w.markets.slug, title: w.markets.title, endsAt: w.dispute_ends_at, selfApproved: w.self_approved })
      ),
      audit: (audit.data as unknown as AuditDb[]).map(toAudit),
    };
  } catch {
    return null;
  }
}
