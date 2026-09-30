/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets the e2e production build live alongside the dev server's `.next`
  // instead of overwriting it (which broke the running dev server).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // All fonts are self-hosted (src/fonts). Turning this off stops Next from
  // trying to inline Google Fonts CSS at build time (Phase 2).
  optimizeFonts: false,
};

module.exports = nextConfig;
