import { notFound } from "next/navigation";

/**
 * TEST-ONLY route for the error-boundary e2e test.
 *
 * The file is a route only in builds with NEXT_PUBLIC_E2E_ERROR_TRIGGER=1 (its
 * extension is added to pageExtensions in next.config.js); a normal build has
 * no /e2e-error route at all. As a second layer the flag is inlined as "1" or
 * "0" and the require below is dead code otherwise.
 */
const Thrower: React.ComponentType | null =
  process.env.NEXT_PUBLIC_E2E_ERROR_TRIGGER === "1"
    ? require("./E2EThrower").default
    : null;

export default function E2EErrorPage() {
  if (!Thrower) notFound();
  return <Thrower />;
}
