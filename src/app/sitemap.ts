import type { MetadataRoute } from "next";
import { indexingAllowed } from "@/lib/indexing";
import { buildSitemap } from "@/lib/sitemap-entries";
import { getMarkets } from "@/services/markets/read";

// Read from the database at request time, never during the build.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexingAllowed()) return [];
  const markets = await getMarkets();
  return buildSitemap(markets.ok ? markets.data.map((m) => m.slug) : []);
}
