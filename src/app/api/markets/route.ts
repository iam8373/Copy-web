import { NextResponse } from "next/server";
import { MARKETS } from "@/data/markets";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const sort = searchParams.get("sort");
  const search = searchParams.get("search")?.toLowerCase();

  let markets = [...MARKETS];

  if (category && category !== "all") {
    markets =
      category === "live"
        ? markets.filter((m) => m.isLive)
        : markets.filter((m) => m.category === category);
  }

  if (search) {
    markets = markets.filter((m) =>
      `${m.title} ${m.category} ${m.subcategory}`.toLowerCase().includes(search)
    );
  }

  if (sort === "popular") markets.sort((a, b) => b.totalVolume - a.totalVolume);
  else if (sort === "starting-soon")
    markets.sort((a, b) => +new Date(a.endDate) - +new Date(b.endDate));

  return NextResponse.json({ count: markets.length, markets });
}
