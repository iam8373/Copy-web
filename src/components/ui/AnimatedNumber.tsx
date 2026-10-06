"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "@/lib/tokens";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { cn } from "@/lib/utils";

/** Close to the emphasized curve (fast start, long settle). */
const easeEmphasized = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

export interface AnimatedNumberProps {
  value: number;
  format: (n: number) => string;
  /** 220–400ms per docs/DESIGN.md → Motion. */
  duration?: number;
  className?: string;
  "data-testid"?: string;
}

/**
 * Odometer-style number: tweens from the previous value to the new one, then
 * stops. Tabular figures keep the width steady while it counts. Jumps straight
 * to the value under prefers-reduced-motion and on first render.
 */
export function AnimatedNumber({
  value,
  format,
  duration = motion.sm,
  className,
  "data-testid": testId,
}: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number>();

  useEffect(() => {
    if (!Number.isFinite(value)) return setShown(value);
    if (reduced || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const v = a + (value - a) * easeEmphasized(p);
      from.current = v;
      setShown(v);
      if (p < 1) frame.current = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration, reduced]);

  return (
    <span className={cn("tnum", className)} data-testid={testId} data-value={value}>
      {format(shown)}
    </span>
  );
}
