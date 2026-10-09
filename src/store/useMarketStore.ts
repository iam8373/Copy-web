"use client";

import { create } from "zustand";
import { MARKETS } from "@/data/markets";
import type { Market } from "@/lib/types";
import { MAX_TRADE, MIN_TRADE, formatLimit, validateAmount } from "@/lib/trade-limits";

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

export interface Position {
  marketId: string;
  outcomeId: string;
  shares: number;
  avgPrice: number;
  /** Set once a market has resolved in the mock ledger. */
  resolved?: "won" | "lost";
}

const POSITIONS_SCHEMA = "v1";
const positionsKey = (handle: string) => `bp-positions:${POSITIONS_SCHEMA}:${handle}`;
/** Marks an account as seeded so the demo ledger is only ever injected once. */

/**
 * Phase C: demo-grade per-user persistence. Parsed data is validated field by
 * field and anything malformed is discarded rather than trusted, so corrupt
 * localStorage can never crash the app. See docs/DECISIONS.md for the planned
 * Supabase migration.
 */
function isValidPosition(raw: unknown): raw is Position {
  if (typeof raw !== "object" || raw === null) return false;
  const p = raw as Record<string, unknown>;
  if (typeof p.marketId !== "string" || typeof p.outcomeId !== "string") return false;
  if (typeof p.shares !== "number" || !Number.isFinite(p.shares) || p.shares <= 0) return false;
  if (typeof p.avgPrice !== "number" || !Number.isFinite(p.avgPrice)) return false;
  if (p.avgPrice < 0 || p.avgPrice > 1) return false;
  if (p.resolved !== undefined && p.resolved !== "won" && p.resolved !== "lost") return false;

  const market = MARKETS.find((m) => m.id === p.marketId);
  if (!market) return false;
  return market.outcomes.some((o) => o.id === p.outcomeId);
}

function readPositions(handle: string): Position[] | null {
  try {
    const raw = window.localStorage.getItem(positionsKey(handle));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPosition).map((p) => ({
      marketId: p.marketId,
      outcomeId: p.outcomeId,
      shares: p.shares,
      avgPrice: p.avgPrice,
      ...(p.resolved ? { resolved: p.resolved } : {}),
    }));
  } catch {
    // Unavailable or corrupt storage: fall back to in-memory only.
    return null;
  }
}

function writePositions(handle: string, positions: Position[]) {
  try {
    window.localStorage.setItem(positionsKey(handle), JSON.stringify(positions));
  } catch {
    /* storage unavailable — keep working in memory */
  }
}

interface MarketState {
  markets: Market[];
  session: Session | null;
  authOpen: boolean;
  /** Re-confirmation of the 18+ consent before trading (AgeConfirmDialog). */
  ageConfirmOpen: boolean;
  searchOpen: boolean;
  trade: TradeIntent | null;
  positions: Position[];
  lastFill: Fill | null;
  toasts: Toast[];
  tick: () => void;
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
  placeOrder: (args: { market: Market; outcomeId: string; amount: number }) => void;
  clearFill: () => void;
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

function jitter(market: Market): Market {
  // Nudge outcome prices by a small amount, keeping binary markets normalised.
  if (market.isBinary) {
    const delta = (Math.random() - 0.5) * 0.024;
    const yes = Math.min(0.97, Math.max(0.03, market.outcomes[0].price + delta));
    return {
      ...market,
      totalVolume: market.totalVolume + Math.round(Math.random() * 900),
      outcomes: [
        {
          ...market.outcomes[0],
          price: Number(yes.toFixed(4)),
          change24h: Number((market.outcomes[0].change24h + delta).toFixed(4)),
        },
        {
          ...market.outcomes[1],
          price: Number((1 - yes).toFixed(4)),
          change24h: Number((market.outcomes[1].change24h - delta).toFixed(4)),
        },
      ],
    };
  }

  const idx = Math.floor(Math.random() * market.outcomes.length);
  return {
    ...market,
    totalVolume: market.totalVolume + Math.round(Math.random() * 1400),
    outcomes: market.outcomes.map((o, i) => {
      if (i !== idx) return o;
      const delta = (Math.random() - 0.5) * 0.02;
      const price = Math.min(0.97, Math.max(0.02, o.price + delta));
      return {
        ...o,
        price: Number(price.toFixed(4)),
        change24h: Number((o.change24h + delta).toFixed(4)),
      };
    }),
  };
}

export const useMarketStore = create<MarketState>((set, get) => ({
  markets: MARKETS,
  session: null,
  authOpen: false,
  ageConfirmOpen: false,
  searchOpen: false,
  trade: null,
  positions: [],
  lastFill: null,
  toasts: [],

  tick: () =>
    set((state) => {
      const count = Math.max(3, Math.round(state.markets.length * 0.18));
      const targets = new Set<number>();
      while (targets.size < count) {
        targets.add(Math.floor(Math.random() * state.markets.length));
      }
      return {
        markets: state.markets.map((m, i) => (targets.has(i) ? jitter(m) : m)),
      };
    }),

  adoptSession: (session, opts) => {
    const stored = readPositions(session.handle);
    const positions = stored ?? [];
    set({ session, authOpen: false, positions });
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
    // Stored positions are deliberately left in place so signing back in
    // restores them; only the in-memory copy is dropped.
    set({ session: null, positions: [] });
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

  placeOrder: ({ market, outcomeId, amount: rawAmount }) => {
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

    const outcome = market.outcomes.find((o) => o.id === outcomeId) ?? market.outcomes[0];
    const shares = amount / Math.max(outcome.price, 0.01);

    const current = get().session;

    if (!current) {
      set({ trade: null, authOpen: true });
      get().pushToast({
        titleKey: "signInToOrder",
        bodyKey: "signInToOrderBody",
        tone: "info",
      });
      return;
    }

    // No recorded 18+ consent (e.g. a Google sign-in whose consent cookie
    // expired): ask again before any order. The server checks it too (B4).
    if (!current.ageConfirmedAt) {
      set({ trade: null, ageConfirmOpen: true });
      return;
    }

    const handle = get().session?.handle;

    set((state) => {
      const existing = state.positions.find(
        (p) => p.marketId === market.id && p.outcomeId === outcome.id && !p.resolved
      );
      const positions = existing
        ? state.positions.map((p) =>
            p === existing
              ? {
                  ...p,
                  avgPrice:
                    (p.avgPrice * p.shares + outcome.price * shares) / (p.shares + shares),
                  shares: p.shares + shares,
                }
              : p
          )
        : [
            ...state.positions,
            {
              marketId: market.id,
              outcomeId: outcome.id,
              shares,
              avgPrice: outcome.price,
            },
          ];

      if (handle) writePositions(handle, positions);

      return {
        trade: null,
        positions,
        lastFill: {
          marketId: market.id,
          outcomeLabel: outcome.label,
          shares,
          price: outcome.price,
          at: Date.now(),
        },
        markets: state.markets.map((m) =>
          m.id === market.id ? { ...m, totalVolume: m.totalVolume + amount } : m
        ),
      };
    });
    get().pushToast({
      titleKey: "orderPlaced",
      bodyKey: "orderFilled",
      vars: {
        shares: shares.toFixed(1),
        outcome: outcome.label,
        price: outcome.price.toFixed(2),
      },
      tone: "success",
    });
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
