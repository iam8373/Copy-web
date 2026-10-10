"use client";

import { create } from "zustand";
import type { Market } from "@/lib/types";
import { MAX_TRADE, MIN_TRADE, formatLimit, validateAmount } from "@/lib/trade-limits";
import { submitOrder } from "@/app/actions/trade";

/**
 * Toasts store i18n coordinates rather than resolved strings: the store has no
 * access to the React context, so `Toaster` resolves them with useT().
 */
export interface Toast {
  id: string;
  titleKey: string;
  bodyKey?: string;
  vars?: Record<string, string | number>;
  tone: "success" | "info" | "error";
}

interface TradeIntent {
  market: Market;
  outcomeId: string;
}

export interface Session {
  /** Email code or Google (no phone/SMS sign-in, D-019). */
  method: "email" | "google";
  /** Display handle: the account's email address */
  handle: string;
  /** Supabase user id (Supabase mode only). */
  userId?: string;
  initial: string;
  /**
   * ISO timestamp of the self-declared 18+ confirmation (Phase D). Sessions
   * restored from before this field existed will be missing it, which forces a
   * re-confirmation before the next order.
   */
  ageConfirmedAt?: string;
}

/** Emitted after a successful order so the success animation can outlive the modal. */
export interface Fill {
  marketId: string;
  outcomeLabel: string;
  shares: number;
  price: number;
  /** Timestamp, also used as the animation key so rapid fills restart cleanly. */
  at: number;
}

/** A position as the server reports it (B5): the store never computes these. */
export interface Position {
  marketId: string;
  outcomeId: string;
  shares: number;
  avgPrice: number;
  realizedPnl?: number;
  /** Settled at resolution. */
  resolved?: "won" | "lost";
}

export interface PortfolioPage<T> {
  rows: T[];
  page: number;
  total: number;
}

export interface OrderRow {
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

const EMPTY_PAGE = { rows: [], page: 1, total: 0 };

/** Error reason → toast body key (translated by the Toaster). */
const ORDER_ERROR_BODY: Record<string, string> = {
  suspended: "orderSuspended",
  trading_disabled: "orderTradingPaused",
  market_closed: "orderMarketClosed",
  invalid_amount: "orderInvalidAmount",
  insufficient_funds: "orderInsufficientFunds",
  rate_limited: "orderRateLimited",
  daily_limit: "orderDailyLimit",
  conflict: "orderFailedBody",
  failed: "orderFailedBody",
};

function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

interface MarketState {
  markets: Market[];
  session: Session | null;
  authOpen: boolean;
  /** Re-confirmation of the 18+ consent before trading (AgeConfirmDialog). */
  ageConfirmOpen: boolean;
  searchOpen: boolean;
  trade: TradeIntent | null;
  /** Server data (B5), loaded by loadPortfolio(); empty when signed out. */
  positions: Position[];
  wallet: number | null;
  orders: PortfolioPage<OrderRow>;
  ledger: PortfolioPage<LedgerRow>;
  /** True while an order is in flight (blocks double submits). */
  orderPending: boolean;
  /** Fetches the signed-in user's own portfolio from GET /api/portfolio. */
  loadPortfolio: (opts?: { ordersPage?: number; ledgerPage?: number }) => Promise<void>;
  lastFill: Fill | null;
  toasts: Toast[];
  /** "loading" until MarketsHydrator runs; "error" when the DB was unreachable. */
  marketsStatus: "loading" | "ready" | "error";
  /**
   * Applies live prices (Realtime or the /api/prices poll). Recomputes each
   * outcome's 24 h change from its reference price; unknown ids are ignored.
   */
  applyPrices: (prices: Record<string, number>) => void;
  signOut: () => void;
  /**
   * Take over a server-verified session (AuthSync). Nothing about the session
   * is written to localStorage; the Supabase auth cookie is the source of
   * truth. `announce` shows the welcome toast (fresh sign-ins only).
   */
  adoptSession: (session: Session, opts?: { announce?: boolean }) => void;
  setAuthOpen: (open: boolean) => void;
  setAgeConfirmOpen: (open: boolean) => void;
  /** Records a server-confirmed consent time on the current session. */
  setAgeConfirmed: (at: string) => void;
  setSearchOpen: (open: boolean) => void;
  openTrade: (market: Market, outcomeId: string) => void;
  closeTrade: () => void;
  placeOrder: (args: { market: Market; outcomeId: string; amount: number }) => Promise<void>;
  clearFill: () => void;
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  markets: [],
  marketsStatus: "loading",
  session: null,
  authOpen: false,
  ageConfirmOpen: false,
  searchOpen: false,
  trade: null,
  positions: [],
  wallet: null,
  orders: EMPTY_PAGE,
  ledger: EMPTY_PAGE,
  orderPending: false,
  lastFill: null,
  toasts: [],

  applyPrices: (prices) =>
    set((state) => {
      let changed = false;
      const markets = state.markets.map((m) => {
        let touched = false;
        const outcomes = m.outcomes.map((o) => {
          const p = prices[o.id];
          if (p === undefined || !Number.isFinite(p) || Math.abs(p - o.price) < 1e-9) return o;
          touched = true;
          const ref = o.refPrice ?? o.price;
          return { ...o, price: p, change24h: Math.round((p - ref) * 10000) / 10000 };
        });
        if (!touched) return m;
        changed = true;
        return { ...m, outcomes };
      });
      return changed ? { markets } : {};
    }),

  loadPortfolio: async (opts) => {
    if (!get().session) return;
    const q = new URLSearchParams({
      orders: String(opts?.ordersPage ?? get().orders.page),
      ledger: String(opts?.ledgerPage ?? get().ledger.page),
    });
    try {
      const res = await fetch(`/api/portfolio?${q}`, { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        balance: number;
        positions: Position[];
        orders: PortfolioPage<OrderRow>;
        ledger: PortfolioPage<LedgerRow>;
      };
      if (!get().session) return; // signed out meanwhile
      set({ wallet: data.balance, positions: data.positions, orders: data.orders, ledger: data.ledger });
    } catch {
      /* offline: keep what we have */
    }
  },

  adoptSession: (session, opts) => {
    const changed = get().session?.handle !== session.handle;
    set({
      session,
      authOpen: false,
      ...(changed ? { positions: [], wallet: null, orders: EMPTY_PAGE, ledger: EMPTY_PAGE } : {}),
    });
    void get().loadPortfolio();
    if (opts?.announce) {
      get().pushToast({
        titleKey: "welcome",
        vars: { handle: session.handle },
        bodyKey: session.method === "email" ? "signedInEmail" : "signedInGoogle",
        tone: "success",
      });
    }
  },

  signOut: () => {
    // Nothing personal stays in memory after sign-out.
    set({ session: null, positions: [], wallet: null, orders: EMPTY_PAGE, ledger: EMPTY_PAGE });
    get().pushToast({ titleKey: "signedOut", tone: "info" });
  },

  setAuthOpen: (open) => set({ authOpen: open }),
  setAgeConfirmOpen: (open) => set({ ageConfirmOpen: open }),
  setAgeConfirmed: (at) =>
    set((state) => ({
      ageConfirmOpen: false,
      session: state.session ? { ...state.session, ageConfirmedAt: at } : null,
    })),
  setSearchOpen: (open) => set({ searchOpen: open }),
  openTrade: (market, outcomeId) => set({ trade: { market, outcomeId } }),
  closeTrade: () => set({ trade: null }),

  placeOrder: async ({ market, outcomeId, amount: rawAmount }) => {
    // Defense in depth (Phase 5): never trust the UI. An invalid amount is
    // refused here even if the form's disabled state was bypassed. The trade
    // modal stays open so the user can correct it.
    const check = validateAmount(rawAmount);
    if (!check.ok) {
      get().pushToast({
        titleKey: "invalidAmount",
        bodyKey: "invalidAmountBody",
        vars: { min: formatLimit(MIN_TRADE), max: formatLimit(MAX_TRADE) },
        tone: "error",
      });
      return;
    }
    const amount = check.value;


    // Signed-out and missing-consent cases are decided by the server (it is
    // the source of truth; the client may not have loaded the session yet).
    // The age check here only saves a round trip when we already know.
    const current = get().session;
    if (current && !current.ageConfirmedAt) {
      set({ trade: null, ageConfirmOpen: true });
      return;
    }

    if (get().orderPending) return;
    set({ orderPending: true });
    const outcome = market.outcomes.find((o) => o.id === outcomeId) ?? market.outcomes[0];
    // One key per click: a retried request with the same key can never
    // spend twice (place_order is idempotent per user + key).
    const r = await submitOrder({
      marketId: market.id,
      outcomeId: outcome.id,
      amount,
      idempotencyKey: newIdempotencyKey(),
    }).catch(() => ({ ok: false as const, reason: "failed" as const }));
    set({ orderPending: false });

    if (!r.ok) {
      if (r.reason === "not_signed_in") {
        set({ trade: null, authOpen: true });
        get().pushToast({ titleKey: "signInToOrder", bodyKey: "signInToOrderBody", tone: "info" });
      } else if (r.reason === "age_not_confirmed") {
        set({ trade: null, ageConfirmOpen: true });
      } else {
        get().pushToast({ titleKey: "orderRejected", bodyKey: ORDER_ERROR_BODY[r.reason] ?? "orderFailedBody", tone: "error" });
      }
      return;
    }

    const { fill } = r;
    get().applyPrices(fill.prices);
    set((state) => ({
      trade: null,
      wallet: fill.balance,
      // The animation and toast show the fill the server actually made.
      lastFill: { marketId: fill.marketId, outcomeLabel: outcome.label, shares: fill.shares, price: fill.avgPrice, at: Date.now() },
      markets: state.markets.map((m) => (m.id === fill.marketId ? { ...m, totalVolume: m.totalVolume + fill.amount } : m)),
    }));
    get().pushToast({
      titleKey: "orderPlaced",
      bodyKey: "orderFilled",
      vars: { shares: fill.shares.toFixed(1), outcome: outcome.label, price: fill.avgPrice.toFixed(2) },
      tone: "success",
    });
    void get().loadPortfolio();
  },

  clearFill: () => set({ lastFill: null }),

  pushToast: (t) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({ toasts: [...state.toasts, { ...t, id }] }));
    setTimeout(() => get().dismissToast(id), 4200);
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
