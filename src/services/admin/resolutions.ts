import "server-only";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { MarketStatus } from "@/lib/admin/market-schema";
import type { Staff } from "./auth";

/** Resolution queue reads (R4). Secret key, after requireStaff (see read.ts). */

export type QueueTab = "needs" | "pending" | "window" | "history";
export const QUEUE_TABS: QueueTab[] = ["needs", "pending", "window", "history"];

export interface Proposal {
  id: string;
  marketId: string;
  marketSlug: string;
  marketTitle: string;
  kind: "outcome" | "void";
  outcomeLabel: string | null;
  evidenceUrl: string;
  note: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "finalized";
  proposer: string | null;
  approver: string | null;
  selfApproved: boolean;
  proposedAt: string;
  approvedAt: string | null;
  disputeEndsAt: string | null;
  decidedReason: string | null;
  finalizedAt: string | null;
}

export interface NeedsRow {
  id: string;
  slug: string;
  title: string;
  status: MarketStatus;
  endDate: string;
  totalVolume: number;
}

const PROPOSAL_COLUMNS =
  "id, market_id, kind, evidence_url, note, status, self_approved, proposed_at, approved_at, dispute_ends_at, decided_reason, finalized_at, " +
  "markets!inner(slug, title), outcomes(label), " +
  "proposer:profiles!resolution_proposals_proposed_by_fkey(handle), approver:profiles!resolution_proposals_approved_by_fkey(handle)";

type ProposalDb = {
  id: string;
  market_id: string;
  kind: Proposal["kind"];
  evidence_url: string;
  note: string;
  status: Proposal["status"];
  self_approved: boolean;
  proposed_at: string;
  approved_at: string | null;
  dispute_ends_at: string | null;
  decided_reason: string | null;
  finalized_at: string | null;
  markets: { slug: string; title: string };
  outcomes: { label: string } | null;
  proposer: { handle: string } | null;
  approver: { handle: string } | null;
};

const toProposal = (r: ProposalDb): Proposal => ({
  id: r.id,
  marketId: r.market_id,
  marketSlug: r.markets.slug,
  marketTitle: r.markets.title,
  kind: r.kind,
  outcomeLabel: r.outcomes?.label ?? null,
  evidenceUrl: r.evidence_url,
  note: r.note,
  status: r.status,
  proposer: r.proposer?.handle ?? null,
  approver: r.approver?.handle ?? null,
  selfApproved: r.self_approved,
  proposedAt: r.proposed_at,
  approvedAt: r.approved_at,
  disputeEndsAt: r.dispute_ends_at,
  decidedReason: r.decided_reason,
  finalizedAt: r.finalized_at,
});

export async function getQueue(
  _staff: Staff,
  tab: QueueTab
): Promise<{ needs: NeedsRow[] } | { proposals: Proposal[] } | null> {
  const db = getAdminSupabase();
  if (tab === "needs") {
    const { data, error } = await db
      .from("markets")
      .select("id, slug, title, status, end_date, total_volume")
      .or(`status.eq.closed,and(status.eq.open,end_date.lte.${new Date().toISOString()})`)
      .order("end_date", { ascending: true })
      .limit(100);
    if (error) return null;
    return {
      needs: data.map((m) => ({
        id: m.id, slug: m.slug, title: m.title, status: m.status as MarketStatus, endDate: m.end_date, totalVolume: Number(m.total_volume),
      })),
    };
  }
  let q = db.from("resolution_proposals").select(PROPOSAL_COLUMNS).limit(100);
  if (tab === "pending") q = q.eq("status", "pending").order("proposed_at", { ascending: true });
  else if (tab === "window") q = q.eq("status", "approved").order("dispute_ends_at", { ascending: true });
  else q = q.in("status", ["finalized", "rejected", "cancelled"]).order("updated_at", { ascending: false });
  const { data, error } = await q;
  if (error) return null;
  return { proposals: (data as unknown as ProposalDb[]).map(toProposal) };
}

export interface ResolutionDetail {
  market: NeedsRow & { resolutionSource: string; outcomes: Array<{ id: string; label: string; price: number }> };
  proposals: Proposal[];
}

export async function getResolutionDetail(_staff: Staff, marketId: string): Promise<ResolutionDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(marketId)) return null;
  const db = getAdminSupabase();
  const [m, p] = await Promise.all([
    db
      .from("markets")
      .select("id, slug, title, status, end_date, total_volume, resolution_source, outcomes!outcomes_market_id_fkey(id, label, price, sort_order)")
      .eq("id", marketId)
      .maybeSingle(),
    db.from("resolution_proposals").select(PROPOSAL_COLUMNS).eq("market_id", marketId).order("proposed_at", { ascending: false }),
  ]);
  if (m.error || !m.data || p.error) return null;
  const r = m.data as typeof m.data & { outcomes: Array<{ id: string; label: string; price: number; sort_order: number }> };
  return {
    market: {
      id: r.id,
      slug: r.slug,
      title: r.title,
      status: r.status as MarketStatus,
      endDate: r.end_date,
      totalVolume: Number(r.total_volume),
      resolutionSource: r.resolution_source,
      outcomes: [...r.outcomes].sort((a, b) => a.sort_order - b.sort_order).map((o) => ({ id: o.id, label: o.label, price: Number(o.price) })),
    },
    proposals: (p.data as unknown as ProposalDb[]).map(toProposal),
  };
}
