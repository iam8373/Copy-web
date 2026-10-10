/**
 * Security headers and Content-Security-Policy (backend B6). Plain CommonJS
 * so next.config.js can require it; also unit-tested.
 *
 * Allowed origins:
 *   - self (pages, self-hosted fonts from src/fonts, /_next assets)
 *   - the Supabase project (REST/Auth over https, Realtime over wss)
 *   - Cloudflare Turnstile: script + iframe from challenges.cloudflare.com
 * 'unsafe-inline' scripts are needed by Next's inline bootstrap without a
 * nonce; 'unsafe-eval' only in development (React Refresh).
 */
function supabaseOrigins(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return [];
    const ws = u.protocol === "https:" ? "wss:" : "ws:";
    return [u.origin, `${ws}//${u.host}`];
  } catch {
    return [];
  }
}

function contentSecurityPolicy({ supabaseUrl = "", dev = false } = {}) {
  const sb = supabaseOrigins(supabaseUrl);
  const turnstile = "https://challenges.cloudflare.com";
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), turnstile],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...sb, turnstile],
    "frame-src": [turnstile],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}

function securityHeaders(opts = {}) {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(opts) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // Ignored by browsers on plain http (local), enforced on the https domain.
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  ];
}

module.exports = { contentSecurityPolicy, securityHeaders, supabaseOrigins };
