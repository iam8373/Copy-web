/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets the e2e production build live alongside the dev server's `.next`
  // instead of overwriting it (which broke the running dev server).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

module.exports = nextConfig;
