import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MARKETS, getMarketBySlug } from "@/data/markets";
import { MarketDetail } from "@/components/MarketDetail";

export function generateStaticParams() {
  return MARKETS.map((m) => ({ slug: m.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const market = getMarketBySlug(params.slug);
  return { title: market ? `${market.title} — BharatPredict` : "Market — BharatPredict" };
}

export default function MarketPage({ params }: { params: { slug: string } }) {
  const market = getMarketBySlug(params.slug);
  if (!market) notFound();

  // Chart, order book and activity come from src/services/markets/market-data.ts.
  return <MarketDetail market={market} />;
}
