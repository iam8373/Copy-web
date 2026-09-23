import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  MARKETS,
  buildActivity,
  buildHistory,
  buildOrderBook,
  getMarketBySlug,
} from "@/data/markets";
import { MarketDetail } from "@/components/MarketDetail";

export function generateStaticParams() {
  return MARKETS.map((m) => ({ slug: m.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const market = getMarketBySlug(params.slug);
  return { title: market ? `${market.title} — Predict` : "Market — Predict" };
}

export default function MarketPage({ params }: { params: { slug: string } }) {
  const market = getMarketBySlug(params.slug);
  if (!market) notFound();

  return (
    <MarketDetail
      market={market}
      history={buildHistory(market)}
      book={buildOrderBook(market)}
      activity={buildActivity(market)}
    />
  );
}
