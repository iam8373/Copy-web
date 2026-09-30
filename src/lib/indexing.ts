/**
 * Phase 3: crawling is OFF unless ALLOW_INDEXING is exactly "true".
 * Set it to "true" only after legal review of the compliance pages.
 *
 * Read at build time for the statically generated robots.txt, sitemap.xml and
 * page metadata, so changing it requires a rebuild.
 */
export function indexingAllowed(): boolean {
  return process.env.ALLOW_INDEXING === "true";
}

/** Canonical origin without a trailing slash. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
