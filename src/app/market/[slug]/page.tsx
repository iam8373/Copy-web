import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MarketDetail } from "@/components/MarketDetail";
import { MarketsUnavailable } from "@/components/MarketsUnavailable";
import { getMarket, getPriceHistory } from "@/services/markets/read";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const r = await getMarket(params.slug);
  const title = r.ok && r.data ? `${r.data.title} — BharatPredict` : "Market — BharatPredict";
  return { title };
}

export default async function MarketPage({ params }: { params: { slug: string } }) {
  const r = await getMarket(params.slug);
  if (!r.ok) return <MarketsUnavailable />;
  if (!r.data) notFound();

  // Recorded price history from the database. If it is too short to draw,
  // the chart falls back to a clearly labelled demo series.
  const history = await getPriceHistory(r.data.id);
  return <MarketDetail market={r.data} history={history.ok ? history.data : []} />;
}
