import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/types";
import { indexingAllowed, siteUrl } from "@/lib/indexing";

const LEGAL_AND_INFO = ["/learn", "/terms", "/privacy", "/responsible-play", "/grievance"];

/**
 * Pure sitemap builder (no I/O), so it is unit-tested directly; sitemap.ts
 * supplies the market slugs from the database. Only meaningful when indexing
 * is allowed: otherwise it returns an empty list, so the URL catalogue is not
 * advertised. /dashboard, /profit (per-user) and /admin are never listed.
 */
export function buildSitemap(marketSlugs: string[], now = new Date()): MetadataRoute.Sitemap {
  if (!indexingAllowed()) return [];
  const base = siteUrl();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    ...CATEGORIES.map((c) => ({
      url: `${base}${c.href}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
    ...marketSlugs.map((slug) => ({
      url: `${base}/market/${slug}`,
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
