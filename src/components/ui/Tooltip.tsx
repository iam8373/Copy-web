"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS_RING, HIT_AREA } from "./focus";

export interface TooltipProps {
  /** Tooltip text. Keep it short; it is also the trigger's description. */
  content: ReactNode;
  /** Accessible name of the default (i) trigger, e.g. "About the order book". */
  label: string;
  /** Custom trigger content; defaults to an info icon. */
  children?: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}

/** Viewport margin the bubble is kept inside, matching the 16 px gutter. */
const EDGE = 16;

/**
 * Info tooltip that works for mouse, keyboard and touch:
 * hover (hover-capable pointers only), focus, or tap to toggle; Escape and
 * outside clicks close it. The bubble is always in the DOM (hidden when
 * closed) so `aria-describedby` resolves for screen readers. It is nudged
 * horizontally to stay inside the viewport at 360 px.
 */
export function Tooltip({ content, label, children, side = "top", className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);

  // Measure after opening and shift back inside the viewport.
  useEffect(() => {
    if (!open) {
      setShift(0);
      return;
    }
    const el = bubbleRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    if (r.left < EDGE) setShift(EDGE - r.left);
    else if (r.right > vw - EDGE) setShift(vw - EDGE - r.right);
  }, [open]);

  const canHover = () =>
    typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

  return (
    <span
      ref={wrapRef}
      className={cn("relative inline-flex align-middle", className)}
      onPointerEnter={() => canHover() && setOpen(true)}
      onPointerLeave={() => canHover() && setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        // Touch: tap toggles. Mouse: hover already opened it, so a click keeps it open.
        onClick={() => (canHover() ? setOpen(true) : setOpen((o) => !o))}
        // Keyboard focus only; a tap also focuses, and would fight the toggle.
        onFocus={(e) => e.currentTarget.matches(":focus-visible") && setOpen(true)}
        onBlur={close}
        className={cn(
          "relative grid h-5 w-5 place-items-center rounded-full text-muted transition-colors duration-xs hover:text-primary",
          HIT_AREA,
          FOCUS_RING
        )}
      >
        {children ?? <Info className="h-3.5 w-3.5" aria-hidden />}
      </button>
      <span
        ref={bubbleRef}
        id={id}
        role="tooltip"
        hidden={!open}
        style={shift ? { marginLeft: shift } : undefined}
        className={cn(
          "absolute left-1/2 z-40 w-max max-w-64 -translate-x-1/2 rounded-btn border border-subtle bg-surface-3 px-3 py-2 text-left text-12 font-normal normal-case tracking-normal text-primary shadow-popover animate-fade-in",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2"
        )}
      >
        {content}
      </span>
    </span>
  );
}
