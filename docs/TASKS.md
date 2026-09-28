# TASKS

Tracking for the BharatPredict work order (Phases A–E).

| Phase | Scope | Status |
| --- | --- | --- |
| A | Trade-success animation | **Done** — commit `feat: trade success animation` |
| — | Fix: live countdowns going stale; leftover USD labels | **Done** — commit `fix: ...` |
| B | ESLint + scripts + Playwright suites + fill 5 empty chips | **Not started** |
| C | Persist positions per user in localStorage | **Not started** |
| D | 18+ age restriction, dedicated `/terms` | **Not started** |
| E1 | Compliance pages + i18n infrastructure + Hindi | **Not started** |
| E2 | Marathi, Bengali, Tamil, Telugu | **Not started** |

## Phase A — detail

- `lastFill` added to the store (`{marketId, outcomeLabel, shares, price, at}`) and set
  inside the successful branch of `placeOrder`, so the animation is independent of the
  modal (which still closes immediately via `trade: null`).
- `TradeSuccess.tsx` renders a small centered, `pointer-events-none` overlay: checkmark
  stroke-draw (`check-draw`) plus scale/fade (`fill-pop`, `fill-out`), total ~1.16s.
- `prefers-reduced-motion` handled twice over: a `matchMedia` check that renders a static
  checkmark, plus `motion-reduce:animate-none` on every animated element.
- `role="status" aria-live="polite"` with an `sr-only` sentence that includes the market
  title (the visible line is truncated).
- Keyed on `lastFill.at` so rapid consecutive orders restart the animation instead of
  stacking; the auto-dismiss timer is cleared on every change.
- The existing toast is unchanged.

## Known gaps carried forward

1. Non-live markets still have hardcoded end dates in the past (e.g. "Will India win the
   2026 T20 World Cup?" ends Mar 8 2026). Titles and dates need a coordinated calendar
   pass — see DECISIONS.md.
2. Positions still reset on refresh (Phase C).
3. No lint config, no test suite yet (Phase B).
