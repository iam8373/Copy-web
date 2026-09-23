import { NextResponse } from "next/server";
import { getMarketBySlug } from "@/data/markets";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { slug?: string; outcomeId?: string; amount?: number }
    | null;

  if (!body?.slug || !body.outcomeId || !body.amount) {
    return NextResponse.json(
      { error: "slug, outcomeId and amount are required" },
      { status: 400 }
    );
  }

  const market = getMarketBySlug(body.slug);
  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  const outcome = market.outcomes.find((o) => o.id === body.outcomeId);
  if (!outcome) {
    return NextResponse.json({ error: "Outcome not found" }, { status: 404 });
  }

  const shares = body.amount / Math.max(outcome.price, 0.01);

  return NextResponse.json({
    status: "filled",
    message: "Order placed successfully!",
    order: {
      market: market.slug,
      outcome: outcome.label,
      price: outcome.price,
      amount: body.amount,
      shares: Number(shares.toFixed(2)),
    },
  });
}
