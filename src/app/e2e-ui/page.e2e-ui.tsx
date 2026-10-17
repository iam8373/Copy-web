import { notFound } from "next/navigation";

/**
 * TEST-ONLY gallery of the shared UI primitives (src/components/ui), used by
 * tests/e2e/ui-primitives.spec.ts and for visual checks in development.
 *
 * The file is a route only in `next dev` and in builds with
 * NEXT_PUBLIC_E2E_UI_GALLERY=1 (the Playwright webServer): its extension is
 * added to pageExtensions in next.config.js. A normal production build does
 * not contain this route at all. The flag check below is a second layer.
 * English-only on purpose: it is not a user-facing page.
 */
const Gallery: React.ComponentType | null =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E_UI_GALLERY === "1"
    ? require("./Gallery").default
    : null;

export const metadata = { robots: { index: false, follow: false } };

export default function E2EUiPage() {
  if (!Gallery) notFound();
  return <Gallery />;
}
