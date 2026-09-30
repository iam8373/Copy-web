/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  },
};

module.exports = nextConfig;
