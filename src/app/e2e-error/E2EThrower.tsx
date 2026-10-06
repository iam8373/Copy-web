"use client";

import { useEffect, useState } from "react";

/**
 * TEST-ONLY. Throws during render when localStorage["bp-e2e-throw"] === "1",
 * so e2e can exercise app/error.tsx and its "Try again" reset. Only bundled
 * when NEXT_PUBLIC_E2E_ERROR_TRIGGER=1 at build time (see page.tsx).
 */
export default function E2EThrower() {
  const [boom, setBoom] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("bp-e2e-throw") === "1") setBoom(true);
    } catch {
      /* ignore */
    }
  }, []);

  // The message is a canary: the e2e test asserts it never reaches the page.
  if (boom) throw new Error("E2E_SECRET_INTERNAL_DETAIL");

  return (
    <p data-testid="e2e-recovered" className="text-primary">
      Recovered
    </p>
  );
}
