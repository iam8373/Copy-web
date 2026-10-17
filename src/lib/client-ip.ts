/**
 * Client IP for our own rate limiters (S3). Pure so it is unit-tested.
 *
 * Trust model (docs/DEPLOY_RUNBOOK.md §5, "Client IP"): Railway's edge sets
 * `X-Real-IP` to the client's remote IP on every public request
 * (https://docs.railway.com/networking/public-networking/specs-and-limits,
 * "Request Headers"), and the service is only reachable through that edge.
 * `X-Forwarded-For` is NOT used: its leftmost entries can be supplied by the
 * client, so trusting them would let anyone pick their own rate-limit key.
 *
 * TRUSTED_CLIENT_IP_HEADER overrides the header (e.g. `cf-connecting-ip` if
 * the domain is ever proxied by Cloudflare, where X-Real-IP would be
 * Cloudflare's address); `none` disables per-IP keys (everyone shares one).
 * Anything that is not a plausible IP becomes "unknown".
 */
export const DEFAULT_CLIENT_IP_HEADER = "x-real-ip";

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-f:]{2,39}$/i;

export function clientIpFrom(
  headers: { get(name: string): string | null },
  trustedHeader: string | undefined = process.env.TRUSTED_CLIENT_IP_HEADER
): string {
  const name = (trustedHeader?.trim() || DEFAULT_CLIENT_IP_HEADER).toLowerCase();
  if (name === "none" || name === "x-forwarded-for") return "unknown";
  const raw = headers.get(name)?.trim() ?? "";
  // A single address only; a list means something upstream appended to it.
  if (!raw || raw.includes(",")) return "unknown";
  const ip = raw.replace(/^\[|\]$/g, "");
  return IPV4.test(ip) || (ip.includes(":") && IPV6.test(ip)) ? ip.toLowerCase() : "unknown";
}
