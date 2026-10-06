"use client";

import { useEffect, useState } from "react";
import { motion } from "@/lib/tokens";

/**
 * True from mount until `ms` later. Entry animations key off it so they play
 * on first paint only, never again when the same view re-renders (filters,
 * live price ticks).
 */
export function useFirstPaint(ms: number = motion.lg) {
  const [first, setFirst] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setFirst(false), ms);
    return () => clearTimeout(id);
  }, [ms]);
  return first;
}
