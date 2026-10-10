import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";

/**
 * Portfolio reads (B5) as the signed-in user: RLS returns only their own
 * wallet, positions, orders and ledger rows. Nothing personal is ever read
 * with the secret key.
 */

export const PAGE_SIZE = 10;

export interface PortfolioPosition {
  marketId: string;
  outcomeId: string;
  shares: number;
  avgPrice: number;
  realizedPnl: number;
  /** Settled at resolution: won/lost, or undefined while open. */
  resolved?: "won" | "lost";
}

export interface PortfolioOrder {
  id: string;
  marketId: string;
  outcomeId: string;
  amount: number;
  shares: number;
  avgPrice: number;
  at: string;
}

export interface LedgerRow {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  at: string;
}

export interface Portfolio {
  balance: number;
  positions: PortfolioPosition[];
  orders: { rows: PortfolioOrder[]; page: number; total: number };
  ledger: { rows: LedgerRow[]; page: number; total: number };
}

export async function getPortfolio(ordersPage = 1, ledgerPage = 1): Promise<Portfolio | null> {
  if (!supabaseConfigured) return null;
  const supabase = getServerSupabase({ readOnly: true });
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return null;

  const op = Math.max(1, ordersPage);
  const lp = Math.max(1, ledgerPage);
  const [wallet, positions, orders, ledger] = await Promise.all([
    supabase.from("wallets").select("balance").eq("user_id", uid).maybeSingle(),
    supabase
      .from("positions")
      .select("market_id, outcome_id, shares, avg_price, realized_pnl, resolved, markets(status, resolved_outcome_id)")
      .eq("user_id", uid)
      .gt("shares", 0),
    supabase
      .from("orders")
      .select("id, market_id, outcome_id, amount, shares, avg_price, created_at", { count: "exact" })
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .range((op - 1) * PAGE_SIZE, op * PAGE_SIZE - 1),
    supabase
      .from("ledger_entries")
      .select("id, amount, type, note, created_at", { count: "exact" })
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .range((lp - 1) * PAGE_SIZE, lp * PAGE_SIZE - 1),
  ]);
  if (wallet.error || positions.error || orders.error || ledger.error) return null;

  return {
    balance: Number(wallet.data?.balance ?? 0),
    positions: (positions.data ?? []).map((p) => {
      const m = p.markets as unknown as { status: string; resolved_outcome_id: string | null } | null;
      const resolved = p.resolved
        ? m?.status === "resolved" && m.resolved_outcome_id === p.outcome_id
          ? ("won" as const)
          : ("lost" as const)
        : undefined;
      return {
        marketId: p.market_id,
        outcomeId: p.outcome_id,
        shares: Number(p.shares),
        avgPrice: Number(p.avg_price),
        realizedPnl: Number(p.realized_pnl),
        ...(resolved ? { resolved } : {}),
      };
    }),
    orders: {
      page: op,
      total: orders.count ?? 0,
      rows: (orders.data ?? []).map((o) => ({
        id: o.id,
        marketId: o.market_id,
        outcomeId: o.outcome_id,
        amount: Number(o.amount),
        shares: Number(o.shares),
        avgPrice: Number(o.avg_price),
        at: o.created_at,
      })),
    },
    ledger: {
      page: lp,
      total: ledger.count ?? 0,
      rows: (ledger.data ?? []).map((l) => ({
        id: l.id,
        amount: Number(l.amount),
        type: l.type,
        note: l.note,
        at: l.created_at,
      })),
    },
  };
}
