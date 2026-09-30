# TASKS

Tracking for the BharatPredict work order (Phases A–E).

| Phase | Scope | Status |
| --- | --- | --- |
| A | Trade-success animation | **Done** — commit `feat: trade success animation` |
| — | Fix: live countdowns going stale; leftover USD labels | **Done** (landed inside `da5cd83`) |
| B | ESLint + scripts + Playwright suites + fill 5 empty chips | **Done** |
| C | Persist positions per user in localStorage | **Done** |
| D | 18+ age restriction, dedicated `/terms` | **Done** |
| E1 | Compliance pages + i18n infrastructure + Hindi | **Done** |
| E2 | Marathi, Bengali, Tamil, Telugu | **Done** — one commit each |

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
2. `npm run build` clobbers the dev server's `.next`; restart the dev container after
   running `check` locally. Playwright reuses the running dev server unless `CI` is set.
3. The dashboard renders each position twice (desktop table + mobile cards, one hidden
   by CSS) — assert with `:visible` in tests.

## Phase E1 — detail

- `src/i18n/en.ts` defines the dictionary; `Dictionary` type derived from it. `hi.ts` is
  typed as `Dictionary`, so a missing key fails `npm run typecheck`.
- `LanguageProvider` + `useT()` (English fallback for unknown keys and unknown stored
  locales). Choice persisted under `bp-lang`; `<html lang>` and `data-script` updated.
- Noto Sans Devanagari/Bengali/Tamil/Telugu via `next/font` (`display: swap`), applied only
  through `html[data-script=...]` selectors. `.tnum` stays on Inter so digits are Latin.
- Translated chrome: category nav, header, sort controls, category headings and counts,
  market card chrome, trade modal, success overlay, auth modal, dashboard, profit, search,
  toasts (now key-based), footer, bottom nav, empty states.
- Desktop language selector added to the header; mobile uses the More sheet chips.
- Market titles/descriptions stay English; `Market.title_hi?` / `description_hi?` exist.
- Subfilter chips translated for display via a `chips` section; filter keys stay English (D-006).

## Phase E2 — detail

- `mr.ts`, `bn.ts`, `ta.ts`, `te.ts`, each 142 keys + 85 chip labels, typed as
  `Dictionary`. Generated from reviewed source maps by a script that refuses to emit a
  file with missing/extra keys or altered `{placeholders}`.
- Parity, empty-string and placeholder checks run for every translated locale; a guard
  fails if any advertised locale falls back to English instead of shipping a dictionary.
- 375px overflow check runs per locale. It caught a real bug in Tamil (sort row pushed the
  page 30px wide); fixed in layout, not by shortening the string.
- Fixed an auth-modal race found while stabilising the suite (form reset raced the 18+
  checkbox).

## Final state

- 12 commits on the session branch, suite **174 passed** on `chromium-desktop` +
  `mobile-pixel5`, twice in a row. `npm run check` green (typecheck, lint, 116-page build).

## Open items (owner decisions)

1. **Legal review — skipped by owner instruction.** All legal copy stays marked
   "Draft — pending legal review". Must be reviewed by Indian counsel before launch.
2. **Native-speaker review** of `hi`, `mr`, `bn`, `ta`, `te` — all machine-drafted.
3. Non-live markets with 2026 titles still carry past end dates (see D-004).
4. First paint is English for non-English users (client-side i18n, D-006).
5. Helpline numbers and the Grievance Officer are placeholders.

---

# Work order 2 — hardening

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Remove unauthenticated API surface | **Done** |
| 2 | Self-host Noto Sans fonts | Not started |
| 3 | robots + sitemap + noindex | Not started |
| 4 | Error boundaries and loading states | Not started |
| 5 | Trade amount validation | Not started |
| 6 | Stored AI translations for market content | Not started |
| 7 | CI workflow | Not started |

## Phase 1 — detail

- Deleted `src/app/api/{markets,markets/[slug],trade}`.
- No helpers became unused: `getMarketBySlug`, `buildHistory`, `buildOrderBook` and
  `buildActivity` are all still used by `/market/[slug]`. (`getMarketsByCategory` was
  already unused before this phase and is left as-is, since it did not *become* unused.)
- `api-removed.spec.ts` asserts 404 for all three paths.
