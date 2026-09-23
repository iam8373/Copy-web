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

interface MarketState {
  markets: Market[];
  connected: boolean;
  searchOpen: boolean;
  trade: TradeIntent | null;
  toasts: Toast[];
  tick: () => void;
  connect: () => void;
  setSearchOpen: (open: boolean) => void;
  openTrade: (market: Market, outcomeId: string) => void;
  closeTrade: () => void;
  placeOrder: (args: { market: Market; outcomeId: string; amount: number }) => void;
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
  connected: false,
  searchOpen: false,
  trade: null,
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

  connect: () => {
    set({ connected: true });
    get().pushToast({
      title: "Predict Account connected",
      description: "Demo wallet linked on BNB Chain testnet.",
      tone: "success",
    });
  },

  setSearchOpen: (open) => set({ searchOpen: open }),
  openTrade: (market, outcomeId) => set({ trade: { market, outcomeId } }),
  closeTrade: () => set({ trade: null }),

  placeOrder: ({ market, outcomeId, amount }) => {
    const outcome = market.outcomes.find((o) => o.id === outcomeId) ?? market.outcomes[0];
    const shares = amount / Math.max(outcome.price, 0.01);
    set((state) => ({
      trade: null,
      markets: state.markets.map((m) =>
        m.id === market.id ? { ...m, totalVolume: m.totalVolume + amount } : m
      ),
    }));
    get().pushToast({
      title: "Order placed successfully!",
      description: `Bought ${shares.toFixed(1)} ${outcome.label} shares @ ${outcome.price.toFixed(2)}`,
      tone: "success",
    });
  },

  pushToast: (t) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({ toasts: [...state.toasts, { ...t, id }] }));
    setTimeout(() => get().dismissToast(id), 4200);
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
