import { NextResponse } from "next/server";
import { getLivePrices } from "@/services/markets/read";

/**
 * Current outcome prices for the live-price poll (public data; cached 5 s on
 * the server, so many pollers mean one database read per window).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const r = await getLivePrices();
  if (!r.ok) return NextResponse.json({ prices: {} }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ prices: r.data }, { headers: { "Cache-Control": "public, max-age=5" } });
}
