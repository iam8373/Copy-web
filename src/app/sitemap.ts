import type { MetadataRoute } from "next";
import { MARKETS } from "@/data/markets";
import { CATEGORIES } from "@/lib/types";
import { indexingAllowed, siteUrl } from "@/lib/indexing";

const LEGAL_AND_INFO = ["/learn", "/terms", "/privacy", "/responsible-play", "/grievance"];

/**
 * Only meaningful when indexing is allowed. With indexing off it returns an
 * empty list, so the URL catalogue is not advertised to anyone.
 * /dashboard and /profit are per-user and never listed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!indexingAllowed()) return [];

  const base = siteUrl();
  const now = new Date();

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    ...CATEGORIES.map((c) => ({
      url: `${base}${c.href}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
    ...MARKETS.map((m) => ({
      url: `${base}/market/${m.slug}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.6,
    })),
    ...LEGAL_AND_INFO.map((p) => ({
      url: `${base}${p}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];
}
