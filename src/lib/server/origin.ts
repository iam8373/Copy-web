import "server-only";
import { headers } from "next/headers";

/**
 * The origin the browser used. `request.url` carries the bind address
 * (0.0.0.0:3000, or the container's) rather than the public host, so prefer
 * NEXT_PUBLIC_SITE_URL, then the proxy's forwarded host (validated).
 */
export function publicOrigin(fallbackUrl?: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site && /^https?:\/\/[^/]+$/.test(site)) return site;
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (fallbackUrl ? new URL(fallbackUrl).protocol.replace(":", "") : "http");
  if (host && /^[A-Za-z0-9.\-]+(:\d+)?$/.test(host)) return `${proto === "https" ? "https" : "http"}://${host}`;
  return fallbackUrl ? new URL(fallbackUrl).origin : "http://localhost:3000";
}

/** Client IP for rate limiting: first X-Forwarded-For hop, else X-Real-IP. */
export function clientIp(): string {
  const h = headers();
  const xff = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || h.get("x-real-ip")?.trim() || "unknown";
}

/** Same-site path only: "/x?y" yes; "//evil", "https://…", "/\\evil" no. */
export function safeNext(raw: string | null | undefined): string {
  const v = raw ?? "/";
  return /^\/(?![\/\\])[\w\-./?=&%]*$/.test(v) ? v : "/";
}
