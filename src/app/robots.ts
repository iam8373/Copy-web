import type { MetadataRoute } from "next";
import { indexingAllowed, siteUrl } from "@/lib/indexing";

/**
 * Disallows everything by default. Only when ALLOW_INDEXING === "true" are
 * crawlers let in, and even then the per-user pages stay out.
 */
export default function robots(): MetadataRoute.Robots {
  if (!indexingAllowed()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Per-user pages and the admin area stay out even when indexing is on.
      disallow: ["/dashboard", "/profit", "/admin"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
