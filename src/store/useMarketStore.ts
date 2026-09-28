"use client";

import { create } from "zustand";
import { MARKETS } from "@/data/markets";
import type { Market } from "@/lib/types";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: "success" | "info" | "error";
}

interface TradeIntent {
  market: Market;
  outcomeId: string;
}

export interface Session {
  /** "phone" or "google" */
  method: "phone" | "google";
  /** Display handle: masked mobile number or email */
  handle: string;
  initial: string;
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
const seededKey = (handle: string) => `bp-seeded:${POSITIONS_SCHEMA}:${handle}`;

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

function hasBeenSeeded(handle: string) {
  try {
    return window.localStorage.getItem(seededKey(handle)) === "1";
  } catch {
    return false;
  }
}

function markSeeded(handle: string) {
  try {
    window.localStorage.setItem(seededKey(handle), "1");
  } catch {
    /* ignore */
  }
}

/** Mock ledger, injected once per account that has never stored anything. */
const SEED_POSITIONS: Position[] = [
  { marketId: "mkt_002", outcomeId: "mumbai-indians", shares: 1420, avgPrice: 0.16 },
  { marketId: "mkt_001", outcomeId: "yes", shares: 860, avgPrice: 0.31 },
  { marketId: "mkt_012", outcomeId: "yes", shares: 540, avgPrice: 0.88 },
  { marketId: "mkt_030", outcomeId: "yes", shares: 2100, avgPrice: 0.61 },
  { marketId: "mkt_021", outcomeId: "ankita-sharma", shares: 320, avgPrice: 0.22 },
  { marketId: "mkt_038", outcomeId: "yes", shares: 780, avgPrice: 0.39, resolved: "won" },
  { marketId: "mkt_004", outcomeId: "no", shares: 410, avgPrice: 0.48, resolved: "lost" },
];

interface MarketState {
  markets: Market[];
  session: Session | null;
  authOpen: boolean;
  searchOpen: boolean;
  trade: TradeIntent | null;
  positions: Position[];
  lastFill: Fill | null;
  toasts: Toast[];
  tick: () => void;
  signIn: (session: Session) => void;
  signOut: () => void;
  setAuthOpen: (open: boolean) => void;
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

  signIn: (session) => {
    // Stored data is the source of truth; the demo ledger is only a first-run
    // convenience for an account that has never persisted anything.
    const stored = readPositions(session.handle);
    let positions: Position[];
    if (stored !== null) {
      positions = stored;
    } else if (hasBeenSeeded(session.handle)) {
      positions = [];
    } else {
      positions = SEED_POSITIONS;
      markSeeded(session.handle);
      writePositions(session.handle, positions);
    }

    set({ session, authOpen: false, positions });
    try {
      window.localStorage.setItem("bp-session", JSON.stringify(session));
    } catch {
      /* storage unavailable — session stays in memory only */
    }
    get().pushToast({
      title: `Welcome, ${session.handle}`,
      description:
        session.method === "phone"
          ? "Signed in with mobile OTP."
          : "Signed in with Google.",
      tone: "success",
    });
  },

  signOut: () => {
    // Stored positions are deliberately left in place so signing back in
    // restores them; only the in-memory copy is dropped.
    set({ session: null, positions: [] });
    try {
      window.localStorage.removeItem("bp-session");
    } catch {
      /* ignore */
    }
    get().pushToast({ title: "Signed out", tone: "info" });
  },

  setAuthOpen: (open) => set({ authOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  openTrade: (market, outcomeId) => set({ trade: { market, outcomeId } }),
  closeTrade: () => set({ trade: null }),

  placeOrder: ({ market, outcomeId, amount }) => {
    const outcome = market.outcomes.find((o) => o.id === outcomeId) ?? market.outcomes[0];
    const shares = amount / Math.max(outcome.price, 0.01);

    if (!get().session) {
      set({ trade: null, authOpen: true });
      get().pushToast({
        title: "Sign in to place an order",
        description: "Use your mobile number or Google account.",
        tone: "info",
      });
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
      title: "Order placed successfully!",
      description: `Bought ${shares.toFixed(1)} ${outcome.label} shares @ ${outcome.price.toFixed(2)}`,
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

/** Restores a persisted demo session on first client render. */
export function restoreSession() {
  try {
    const raw = window.localStorage.getItem("bp-session");
    if (!raw) return;
    const parsed = JSON.parse(raw) as Session;
    if (parsed?.handle && parsed?.initial) {
      const stored = readPositions(parsed.handle);
      let positions: Position[];
      if (stored !== null) {
        positions = stored;
      } else if (hasBeenSeeded(parsed.handle)) {
        positions = [];
      } else {
        positions = SEED_POSITIONS;
        markSeeded(parsed.handle);
        writePositions(parsed.handle, positions);
      }
      useMarketStore.setState({ session: parsed, positions });
    }
  } catch {
    /* ignore malformed storage */
  }
}
