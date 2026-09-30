import { notFound } from "next/navigation";

/**
 * TEST-ONLY route for the error-boundary e2e test.
 *
 * NEXT_PUBLIC_E2E_ERROR_TRIGGER is inlined at build time via next.config.js
 * `env` as the literal "1" or "0". In a normal build the condition folds to
 * `"0" === "1"`, webpack drops the require, and E2EThrower is not bundled at
 * all — the route just renders the 404 page.
 */
const Thrower: React.ComponentType | null =
  process.env.NEXT_PUBLIC_E2E_ERROR_TRIGGER === "1"
    ? require("./E2EThrower").default
    : null;

export default function E2EErrorPage() {
  if (!Thrower) notFound();
  return <Thrower />;
}
