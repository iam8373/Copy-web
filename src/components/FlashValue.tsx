"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Renders a value and flashes green/red whenever it moves. */
export function FlashValue({
  value,
  children,
  className,
}: {
  value: number;
  children: React.ReactNode;
  className?: string;
}) {
  const prev = useRef(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (Math.abs(value - prev.current) > 0.0005) {
      setDir(value > prev.current ? "up" : "down");
      prev.current = value;
      const t = setTimeout(() => setDir(null), 900);
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);

  return (
    <span
      className={cn(
        "tnum",
        dir === "up" && "animate-flash-up",
        dir === "down" && "animate-flash-down",
        className
      )}
    >
      {children}
    </span>
  );
}
