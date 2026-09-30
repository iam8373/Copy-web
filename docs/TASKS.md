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
| 2 | Self-host Noto Sans fonts | **Done** |
| 3 | robots + sitemap + noindex | **Done** |
| 4 | Error boundaries and loading states | **Done** |
| 5 | Trade amount validation | **Done** |
| 6 | Stored AI translations for market content | **Done** |
| 7 | CI workflow | Not started |

## Phase 1 — detail

- Deleted `src/app/api/{markets,markets/[slug],trade}`.
- No helpers became unused: `getMarketBySlug`, `buildHistory`, `buildOrderBook` and
  `buildActivity` are all still used by `/market/[slug]`. (`getMarketsByCategory` was
  already unused before this phase and is left as-is, since it did not *become* unused.)
- `api-removed.spec.ts` asserts 404 for all three paths.

## Phase 2 — detail

- Removed every `next/font/google` import **and** the Inter `@import` from
  `fonts.googleapis.com` in `globals.css` (not in the known-facts list, but it also broke
  the "no Google Fonts URLs" acceptance).
- `src/fonts/`: Noto Sans Devanagari/Bengali/Tamil/Telugu at 400 + 600, Inter latin at
  400/500/600/700, all from `@fontsource/*` 5.3.0, OFL-1.1, license texts included. The
  `@fontsource` packages were installed into a scratch directory only; they are not in
  `package.json`.
- Loaded with `next/font/local`, `display: "swap"`. Inter `preload: true`; Noto
  `preload: false`, referenced only under `html[data-script=...]`.
- `optimizeFonts: false` in `next.config.js`.
- Verified: build succeeds with both Google hosts blackholed in `/etc/hosts` (IPv4 + IPv6);
  0 Google references in rendered HTML, RSC payloads and CSS.
- `fonts.spec.ts`: no page requests Google; English loads Inter only; Hindi loads
  Devanagari and none of the other scripts.

**Known residue:** two Next.js framework chunks still contain the literal string
`https://fonts.googleapis.com/` — Next's own `GOOGLE_FONT_PROVIDER` constant from
`next/dist/shared/lib/constants.js`, bundled into the Pages-Router runtime (`main-*.js`,
loaded by 0 of 112 app pages) and one server chunk. It is a constant, never a request, and
cannot be removed without patching Next. See D-010.

## Phase 3 — detail

- `src/lib/indexing.ts`: `indexingAllowed()` is true only for `ALLOW_INDEXING === "true"`;
  `siteUrl()` normalises `NEXT_PUBLIC_SITE_URL`.
- `src/app/robots.ts`: default `Disallow: /` with no sitemap; when allowed, `Allow: /`,
  `Disallow: /dashboard, /profit`, sitemap URL.
- `src/app/sitemap.ts`: home, 12 category pages, 91 market pages, 5 info/legal pages;
  returns `[]` when indexing is off, so the catalogue is not advertised.
- Root layout `metadata.robots` = noindex/nofollow unless allowed; every page inherits it.
- `crawling.spec.ts`: HTTP checks on the default build, plus direct calls to the route
  handlers with the env flipped (covers the allowed branch without a second build, and
  proves `"TRUE"`, `"1"`, `" true"` etc. stay blocked).

## Phase 4 — detail

- `src/app/error.tsx` (client, inside the root layout, "Try again" calls `reset`, link
  home), `src/app/global-error.tsx` (own `<html>/<body>`, imports `globals.css`, reads
  `bp-lang` directly because `LanguageProvider` is unavailable there).
- Loading skeletons: root, `/markets/[category]`, `/market/[slug]`, `/dashboard`,
  `/profit` — each matches its page's shape. Shared `Skeleton.tsx`; pulses use
  `motion-safe:animate-pulse`. Regions use `aria-busy` + a translated sr-only label, not
  `role="status"` (reserved for the trade confirmation overlay).
- New i18n sections `errors` (5 keys) and `loading` (1 key) in all six locales; parity
  tests cover them automatically.
- No `error.message` or stack is ever rendered or logged; only Next's opaque `digest`.
- Test-only trigger: `/e2e-error` + `E2EThrower`. `next.config.js` inlines
  `NEXT_PUBLIC_E2E_ERROR_TRIGGER` as `"1"`/`"0"`; with `"0"` the `require` is folded away.
  Verified: a normal build contains 0 references to the thrower; the Playwright build
  (which sets the flag) contains it. In a normal build the route renders 404.
- `errors.spec.ts`: error UI + working Try again, persistent failure, Hindi, no leaked
  message/stack, skeleton pulse on/off under reduced motion.
- Locale files are now the source of truth; `.scratch/` generators are not committed.

## Phase 5 — detail

- `src/lib/trade-limits.ts`: `MIN_TRADE = 1`, `MAX_TRADE = 100_000`, `TRADE_STEP = 1`,
  `TRADE_PRESETS`, `validateAmount()` → `{ ok, value }` / `{ ok: false, reason }`
  (`notNumber` | `belowMin` | `aboveMax`), `clampAmount()`, `formatLimit()` (en-IN).
- `AmountField.tsx`: one control used by the quick-trade modal **and** the market detail
  panel (which had the same input/slider mismatch). Parent owns the raw string, so empty
  is representable; input, slider, presets and Max share min/max/step and always agree.
  Out-of-range typing is kept and explained inline (not silently clamped); the slider pins
  to the nearest bound; Place order is disabled for any invalid amount.
- `placeOrder` validates first and refuses with an `error` toast; the modal stays open.
- New keys `trade.{limits,errorInvalid,errorMin,errorMax,slider}` and
  `toast.{invalidAmount,invalidAmountBody}` in all six locales. The detail panel's
  previously hard-coded English (Amount, shares, Avg price, Place Order, settlement note)
  now uses existing keys.
- `trade-limits.spec.ts`: validator unit tests, store-level refusal with no UI, and UI tests
  for 0 / -5 / empty / 1e9, ₹1 and max, and input↔slider sync.

**Known gap:** the rest of the market detail page (chart heading, order book, rules,
activity feed) is still English-only; it predates i18n and was out of scope here.

## Phase 6 — detail

- **Data:** `src/data/market-translations.json`, keyed by market id, each entry
  `{ sourceHash, translatedAt, status, locales: { hi, mr, bn, ta, te } }`.
- **Service** `src/services/translation/`: `types.ts`, `hash.ts` (sha256 of
  title + description + subcategory), `glossary.ts`, `prompt.ts`, `validate.ts`,
  `translate.ts` (ONE `fetch` to Chat Completions per market, `json_schema` strict, all
  five locales), `store.ts` (read/write + `planWork`), `run.ts` (the testable runner).
- **Script** `npm run translate:markets` (`scripts/translate-markets.ts`, via `tsx`):
  loads `.env.local`, translates only missing/stale markets, `--dry-run`, `--market <id>`,
  `--max-markets N` (default 25). Nothing to do → 0 API calls and no key needed.
- **Runtime** `src/lib/market-text.ts`: `getMarketText()` / `useMarketText()` read the
  JSON; English fallback for `en`, missing market, missing locale, or stale hash. Used by
  MarketCard (text source only), market detail (title, description, "Translated
  automatically" note), search (display + matches saved title), dashboard/profit rows,
  featured carousel and trade modal header.
- **Protected terms** live in the UI i18n (`terms` section, all six locales); the prompt
  and validator are built from them.
- **Validator** rejects: missing/altered numbers, ₹ amounts or tickers; added numbers;
  empty; > 2× source length; identical to English or containing a run of 3 lowercase
  English source words (capitalised proper nouns allowed); wrong protected-term
  rendering; wrong JSON shape. Retries once, then leaves English and reports.
- **Security:** `.env*` ignored except `.env.example`; `OPENAI_API_KEY`/`OPENAI_MODEL`
  blank in `.env.example`, no default model; ESLint `no-restricted-imports` stops app code
  importing `translate`/`run`/`store`; `translate.ts` throws if loaded in a browser; key
  never logged. `npm run check:secrets` (fails closed on git errors) and
  `npm run validate:translations` are ready for CI.
- **Seed content:** 8 markets (mkt_001, 002, 012, 021, 030, 038, 047, 056) translated into
  all five locales. **Drafted by the coding assistant, not by the script** — no API key
  exists in this sandbox. They pass the same validator and are `machine-drafted`. The other
  83 markets show English until the script is run with a real key.
- **Tests** `translation.spec.ts` (58 across both projects): sha256 parity, validator
  accept/reject cases, runner behaviour against a fake OpenAI (twice → 0 calls, one title
  change → one call, reviewed not overwritten, retry once, stale entry removed on failure,
  missing key/model, dry-run, `--market`, `--max-markets`, key never logged), runtime
  fallback, and browser checks (Hindi cards, English fallback, note, search, 0 requests to
  openai.com).
- **Bug found and fixed:** the runtime hash cache was keyed by market id, so an edited
  market would keep showing its old translation. Now keyed by the source text.
