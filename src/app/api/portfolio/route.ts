import { NextResponse, type NextRequest } from "next/server";
import { getPortfolio } from "@/services/portfolio/server";

/**
 * The signed-in user's own wallet, positions, orders and ledger (B5).
 * 401 when signed out; never cached. GET so it can be read on mount without
 * the router side effects of a Server Action.
 */
export const dynamic = "force-dynamic";

const page = (v: string | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const data = await getPortfolio(page(url.searchParams.get("orders")), page(url.searchParams.get("ledger")));
  const headers = { "Cache-Control": "no-store, max-age=0", Vary: "Cookie" };
  if (!data) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  return NextResponse.json(data, { headers });
}
