import { NextResponse } from "next/server";
import {
  buildActivity,
  buildHistory,
  buildOrderBook,
  getMarketBySlug,
} from "@/data/markets";

export function GET(_request: Request, { params }: { params: { slug: string } }) {
  const market = getMarketBySlug(params.slug);
  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }
  return NextResponse.json({
    market,
    history: buildHistory(market),
    orderBook: buildOrderBook(market),
    activity: buildActivity(market),
  });
}
