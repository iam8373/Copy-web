"use client";

import { useEffect, useState } from "react";
import { media } from "@/lib/tokens";

/** True when the user asked for reduced motion; follows live changes. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(media.reducedMotion);
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}
