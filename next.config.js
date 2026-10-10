const { securityHeaders } = require("./src/lib/security-headers");

const HEADERS = securityHeaders({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  dev: process.env.NODE_ENV !== "production",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Docker image (Railway, D-025) runs the self-contained server from
  // `.next/standalone`; local `next start` and the e2e builds do not need it.
  ...(process.env.NEXT_OUTPUT_STANDALONE === "1" ? { output: "standalone" } : {}),
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: HEADERS },
      // Personal and (future) admin pages are never cached by shared caches
      // and never indexed, whatever ALLOW_INDEXING says.
      {
        source: "/(dashboard|profit|admin)(.*)",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  // Lets the e2e production build live alongside the dev server's `.next`
  // instead of overwriting it (which broke the running dev server).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // All fonts are self-hosted (src/fonts). Turning this off stops Next from
  // trying to inline Google Fonts CSS at build time (Phase 2).
  optimizeFonts: false,
  // Inlined at build time as "1" or "0" so test-only code (src/app/e2e-error)
  // is dead-code-eliminated from normal builds (Phase 4).
  env: {
    NEXT_PUBLIC_E2E_ERROR_TRIGGER:
      process.env.NEXT_PUBLIC_E2E_ERROR_TRIGGER === "1" ? "1" : "0",
    // Same idea for the UI primitives gallery (src/app/e2e-ui).
    NEXT_PUBLIC_E2E_UI_GALLERY:
      process.env.NEXT_PUBLIC_E2E_UI_GALLERY === "1" ? "1" : "0",
  },
};

module.exports = nextConfig;
