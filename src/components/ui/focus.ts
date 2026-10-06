/**
 * Keyboard focus ring shared by every interactive primitive. Shown only for
 * keyboard focus (:focus-visible), offset from the surface so it reads on
 * filled buttons too.
 */
export const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1";

/**
 * Invisible 44 x 44 px (minimum) hit area centred on a smaller control, so
 * 32/40 px visuals still meet the touch-target rule (docs/DESIGN.md).
 * The element using it must be `relative`.
 */
export const HIT_AREA =
  "before:absolute before:left-1/2 before:top-1/2 before:h-full before:min-h-touch before:w-full before:min-w-touch before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']";
