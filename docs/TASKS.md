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
| 7 | CI workflow | **Done** |

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

## Phase 7 — detail

- `.github/workflows/ci.yml`: on `pull_request` and `push` to `main`. `permissions:
  contents: read`, no secrets, `persist-credentials: false`, concurrency cancels stale
  runs, 30-minute timeout.
- Steps: checkout → Node `lts/*` with npm cache → `npm ci` → `check:secrets` → typecheck →
  lint → `validate:translations` → `build` → `scripts/verify-build.sh` → install Playwright
  chromium (`--with-deps`) → `test:e2e` → upload `playwright-report/` + `test-results/`
  on failure (7-day retention).
- Actions pinned to full commit SHAs, resolved from the GitHub API:
  checkout v4.2.2 `11bd719…`, setup-node v4.4.0 `49933ea…`, upload-artifact v4.6.2
  `ea165f8…`.
- `scripts/verify-build.sh` asserts on a normal build: the test-only error trigger is
  compiled out, no OpenAI references, no Google Fonts URLs in pages/CSS. Proven both ways:
  passes on a normal build, fails on a build made with the e2e flag.
- `playwright.config.ts` also writes the HTML report when `CI` is set.
- Verified locally: `actionlint` 1.7.12 reports no problems; `npm ci` lockfile in sync;
  every CI step replayed in order in the container; e2e with `CI=true` → 306 passed.

**Not verified:** the workflow has never run on GitHub itself — `git push` has no
credentials in this sandbox.

---

# Work order 3 — real backend + admin panel

Stack: Supabase (Postgres, Auth, Realtime, RLS), Next.js server components / actions /
route handlers, zod, Vercel. Virtual play credits only.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Schema, RLS, seed | **Done** |
| 2 | Real authentication | Not started |
| 3 | Read path from the database | Not started |
| 4 | Trading engine + wallet | Not started |
| 5 | Portfolio from the database | Not started |
| 6 | Admin panel (core) | Not started |
| 7 | Translations in the admin panel | Not started |
| 8 | Admin: users, compliance, safety | Not started |
| 9 | Hardening and tests | Not started |
| 10 | Deployment | Not started |

## Phase 1 — detail

- `supabase/config.toml` (`supabase init`, project id `bharat-predict`; analytics and
  edge runtime disabled).
- `supabase/migrations/20261001000100_core_schema.sql`: 12 tables (profiles, markets,
  outcomes, market_translations, wallets, ledger_entries, orders, positions,
  price_history, audit_log, grievances, app_settings). uuid keys, CHECK constraints for
  every enum, composite FKs so an order/position/price row can't name an outcome from a
  different market, `updated_at` triggers on mutable tables.
- Ledger: `ledger_entries` is append-only (trigger rejects UPDATE/DELETE for every role);
  a BEFORE INSERT trigger applies each entry to `wallets.balance`, which is
  `CHECK (balance >= 0)`, so no entry can overdraw. Partial unique index allows one
  `signup_credit` per user. `orders`, `price_history`, `audit_log` are append-only too.
- `supabase/migrations/20261001000200_rls.sql`: RLS on all 12 tables; only SELECT
  policies (public non-draft market data; own profile/wallet/ledger/orders/positions);
  all anon/authenticated privileges revoked then SELECT re-granted; service role granted
  explicitly.
- `supabase/seed.sql`: `app_settings` defaults (trading_enabled, min/max trade,
  signup_credit 10,000, default_liquidity_b 1,000).
- `npm run db:seed` (`scripts/db-seed.ts` + pure `scripts/seed-rows.ts`): imports 91
  markets, 227 outcomes and 40 saved translations via the service role. Insert-if-missing,
  so re-runs are no-ops. Initial prices are normalised to sum to 1 and converted to LMSR
  quantities. Past end dates seed as `closed`; top 5 by volume are `is_featured`.
- `src/lib/lmsr.ts`: reference LMSR math (prices, cost, quantities, shares-for-amount in
  log space).
- `src/types/database.ts`: generated with `supabase gen types`; `npm run db:types`.
- Tests: `supabase/tests/001_schema_rls.test.sql` (pgTAP, 31 checks) and
  `tests/e2e/db-schema.spec.ts` (14 node checks: category CHECK = CATEGORIES, every table
  has RLS, no write grants/policies, LMSR math, seed rows).

**Results:** typecheck, lint, build clean; pgTAP 31/31; Playwright 334/334 (desktop +
mobile); seed run twice → `+91/+227/+40` then `+0/+0/+0`; max |Σprice − 1| = 1e-10.

**Bugs found:** (1) `sharesForAmount` overflowed (`e^{amount/b}`) for large orders — now
evaluated in log space. (2) Recreating the schema dropped the service role's grants, so the
seed got "permission denied"; the migration now grants it explicitly.

---

# Work order 4 — design system and market page

Order agreed with the owner: UI first, then the provider-agnostic translation change, then
back to backend Phase 2. Data behind `getPriceHistory`, `getOrderBook`,
`getMarketActivity` so the backend swap is one file per function.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundations: DESIGN.md, tokens, fonts, hard-coded value cleanup | Done |
| 2 | Shared components (`src/components/ui/`) | Done |
| 3 | Home and navigation polish | Done |
| 4 | Market detail page | Done |
| 5 | Motion pass | Done |
| 6 | Tests and docs | Done |
| 7 | Jev AI decision layer | Not started — needs a TypeSafe API key and a chosen use case |
| — | Translation provider-agnostic (OpenAI or Gemini) | Done (D-018) |

## Backlog

- **Sell-back** in the trading engine (LMSR sell), then a Sell tab in the trade panel.
  The panel is buy-only until then.
- "New" sort chip once the backend exposes `created_at`.
- **Demo fills ignore price impact.** The order book quotes LMSR costs, but the demo store
  still fills at the displayed price (`shares = amount / price`). The backend
  `place_order` fixes this; until then the order book footnote says so.
- Positions tab on the market page could list the signed-in user's own positions in that
  market (data already in the store); kept as an empty state per the agreed scope.
- Market data (category blurbs, sub-categories, outcome labels) is English-only until the
  backend serves translations.

## Phase 1 — progress

- `docs/DESIGN.md` written first.
- Tokens: CSS variables (RGB channels, per theme) in `globals.css`; Tailwind names in
  `tailwind.config.ts` (extends defaults only); `src/lib/tokens.ts` for Recharts/SVG.
- Fonts: Inter → active Noto → system-ui via `--font-indic`; Geist Mono (400/500/600,
  OFL file included) for aligned numerals, `preload: false`.
- `npm run check:tokens` added and run in CI; it passes on all of `src/`.
- Cleanup in 5 batches, each checked at 360/1280 px in both themes: (1) header, nav,
  footer, toaster, language picker; (2) market card, grid, home feed, carousel, category,
  search; (3) market detail, trade modal, amount field, auth modal; (4) dashboard, profit,
  skeletons, error/not-found/loading; (5) legal and learn pages, category tint map.
- Legacy Tailwind aliases (`bg-bg-*`, `text-content-*`, colour `subtle`/`strong`) deleted;
  brand `accent-*` names kept as aliases of the semantic colours.
- `min-w-table` (720px) token for the dashboard positions table.
- Fixed: ThemeProvider wrote "dark" before reading the saved theme (lost under StrictMode);
  `<kbd>` hints inherited the mono font and pulled Geist Mono into every English page.
- Found: white text on the old brand fill `#7C5CFF` was 4.35:1 (fails AA) → `brand-fill`.

**Results:** typecheck, lint, check:tokens clean; Playwright 334/334; no horizontal
overflow on any checked page at 360 px.

## Phase 2 — progress

- `src/components/ui/`: Button, IconButton, Chip, Badge, Card, EmptyState, Tabs/TabPanel,
  Tooltip, Dialog (bottom sheet below `sm`), shared `FOCUS_RING` and `HIT_AREA`. Spec in
  `docs/DESIGN.md` → Components. No new dependencies, no new strings (reuses
  `loading.label` and `bottomNav.close`).
- Test-only gallery `/e2e-ui`, compiled out of normal builds (`NEXT_PUBLIC_E2E_UI_GALLERY`,
  same pattern as `/e2e-error`); `scripts/verify-build.sh` checks it is absent.
- `tests/e2e/ui-primitives.spec.ts` (11 tests × 2 projects): 32/40/48 px visuals with
  ≥ 44 px hit areas, aria-pressed chips, tab keyboard model, tooltip by keyboard/tap and
  viewport clamping, dialog focus trap / Escape / focus return / scroll lock, bottom sheet
  at 360 px, no overflow in both themes.
- **Bug found and fixed:** `cn()` (tailwind-merge) didn't know the custom `text-11…32`
  sizes, so it treated them as colours. Since the Phase 1 cleanup turned `text-[13px]` into
  `text-13`, any `cn("text-13 …", "text-success")` dropped one class (e.g. trade modal and
  category chips lost their font size; Yes/No buttons lost their colour). `cn()` now uses
  `extendTailwindMerge` with the font-size and shadow tokens.
- Existing screens are not migrated yet; that happens in Phases 3 (home, navigation) and 4
  (market page, trade panel).

**Results:** typecheck, lint, check:tokens clean; verify-build passes on a normal build;
Playwright 356/356.

## Phase 3 — progress

- **Category sort:** Trending (24h volume change) / Popular (total volume) / Starting
  Soon (soonest end first, ended markets last); Trending is the default. Rendered as a
  segmented control so it reads differently from the filter chips. "All" removed.
- **Sub-filter and language chips** use `Chip` (data-testids kept).
- **Home:** every heading and label translated (they were hard-coded English): section
  titles reuse `nav.*`, new `home.*` keys. Popular's "View all" went to `/markets/cricket`;
  removed, since there is no Popular page. "View all" links have a section-specific
  accessible name and a 44px target.
- **Featured carousel:** pause/resume button; pauses on hover or focus; never rotates
  under reduced motion or in a hidden tab; slide changes announced only when user-driven;
  prev/next/dots have 44px targets and translated labels.
- **MarketCard (restyle only, same structure):** category label translated, `Badge` for
  Live, `Button` for Trade, focus rings, `shadow-card`, outcome rows 44px on touch
  pointers.
- **Header:** `Button`/`IconButton`, focus rings, account menu has `aria-expanded` and
  closes on Escape with focus returned; wordmark hidden below `xs` (400px) because Tamil
  pushed the theme button off-screen at 360px.
- **CategoryNav / BottomNav:** named `<nav>` landmarks, `aria-current="page"`, 44px
  targets. The More sheet is now `Dialog` (focus trap, Escape, scroll lock, focus return).
- **Search:** ARIA combobox + listbox (`aria-activedescendant`), focus kept inside, page
  scroll locked, focus returned on close, translated category/volume labels.
- `MarketGrid` empty state uses `EmptyState`.
- New strings in all six locales: `home.*`, `sort.trending`, `category.sortBy`,
  `nav.categories`, `bottomNav.label`, `search.label`; `sort.all` removed.
- Tests: `tests/e2e/home-nav.spec.ts` (sort orders, carousel pause and reduced motion,
  aria-current, search combobox, account menu Escape, More sheet, Hindi home, Tamil and
  Telugu at 360px). `translation.spec.ts` search test now uses the combobox/option roles.

**Not changed (out of scope):** category blurbs, sub-category names and outcome labels
are market data and stay English until the backend serves translations.

**Results:** typecheck, lint, check:tokens clean; Playwright 380/380.

## Phase 4 — progress

- **Data behind three functions** in `src/services/markets/market-data.ts`:
  `getPriceHistory(market, range)` (seeded demo walk ending at the live price, flagged
  `isDemo`), `getOrderBook(market, outcomeId)` (LMSR quotes), `getMarketActivity(market)`
  (empty). The page route no longer builds data; `buildHistory/buildOrderBook/buildActivity`
  (fake order book in `$`, invented usernames) are deleted.
- **Layout:** lg+ = content + sticky 360px trade panel (`grid-cols-market`); below lg = a
  fixed Yes/No bar (multi: "Trade this market") above the BottomNav (`--bottom-nav-h`) that
  opens the trade sheet.
- **Chart:** "Demo data" badge + tooltip; 1D/1W/1M/All; binary = one area line with the big
  "NN% chance" figure; multi = top 4 outcomes in chart-1…4 with a legend; ticks never repeat
  a date; text summary as the chart's accessible name; draw-in only on first paint and not
  under reduced motion; series built after mount (no SSR/hydration drift) and anchored so
  live ticks move only the last point.
- **Order Book:** honest AMM ladder for 10/50/100/500 shares — avg price, total cost (₹),
  price after and impact (warning colour above 5 pts). Tooltip explains the market maker;
  footnote states the liquidity (b = 1,000, D-017) and the demo fill caveat. Yes/No switch
  for binary; multi follows the selected outcome. Multi-outcome prices that sum to < 1 get a
  "rest of field" bucket so quotes start at the displayed price.
- **Outcomes list** (multi): all outcomes by price with chart colours and Buy buttons
  (selects in the panel on lg, opens the sheet below).
- **Rules & resolution** accordion (`aria-expanded`), **Activity / Top holders / Positions /
  Comments** tabs, each an `EmptyState`.
- **TradeForm** shared by the panel and `TradeModal` (now on `Dialog`): Yes/No tinted
  outcome buttons (`aria-pressed`), amount, avg price, shares, payout with return %, Place
  Order. Buy only (Sell is in the backlog).
- New `Segmented` primitive (sort, chart range, order book outcome).
- Every page string translated in all six locales (`market.*`); it was mostly hard-coded
  English before.
- **Bug fixed on the way:** an element with both a display class (`flex`) and the `hidden`
  attribute stays visible (the class wins), so the rules panel never collapsed in the first
  draft; it toggles classes now.
- Tests: `tests/e2e/market-page.spec.ts` (service functions, chart, order book, empty tabs,
  rules, Hindi, 360px, desktop panel, mobile bar and sheet). `trade-limits.spec.ts` opens the
  sheet on mobile.

**Results:** typecheck, lint, check:tokens clean; Playwright 406/406.

## Phase 5 — progress

- Page fade (`app/template.tsx`), grid/row stagger (30ms, max 8, first paint only,
  `useFirstPaint`), rules accordion height animation (a11y-safe via `visibility`),
  `AnimatedNumber` odometer (trade payout and shares, chart headline), `Dialog` exit
  animation (TradeModal keeps its last trade so the sheet can animate out), shared
  `useReducedMotion` hook. New keyframes `fade-out`, `slide-down`.
- `tests/e2e/motion.spec.ts`: page fade is opacity-only, stagger steps and cap, no replay
  on re-sort, only status indicators loop after 1.5s, nothing runs under reduced motion,
  accordion visibility/transition, odometer settles on the exact value, dialog exit.

## Phase 6 — progress

- `tests/e2e/contrast.spec.ts`: WCAG AA computed from `globals.css` for text, semantic
  colours, button fills, tinted chips/badges/buttons, borders, focus ring and chart lines,
  in both themes. **Found:** Yes/No/brand/warning text on their own 15–25 % tints was
  4.0–4.4 : 1. Fixed by adjusting six shades (light success/danger/warning/brand, dark
  brand/danger) and capping hover tints at 20 %.
- `tests/e2e/sweep.spec.ts`: 18 routes × 2 themes × 2 projects at 360 px, signed-in
  dashboard/profit, and a keyboard focus sweep on four pages. **Found:** the home page had
  no `h1` (added, visually hidden).
- README: design-system section, `check:tokens`, updated structure and features.
  DESIGN.md: Enforcement table.

## Translation provider — progress

- `translateMarket` dispatches to OpenAI or Gemini; `resolveProvider(env)` picks one
  (D-018). Run output names the provider and model; keys are never logged.
- Tests (fake endpoints, no network): Gemini request shape (header key, schema, system
  instruction), validator + retry on Gemini output, SAFETY block, provider selection
  matrix, both-keys refusal, model-id guard, transient backoff.
- Live check: one market translated with `gemini-3.1-flash-lite` into a temp file.
- `.env.local` (sandbox, not committed): `GEMINI_MODEL=gemini-3.1-flash-lite`,
  `TRANSLATION_PROVIDER=gemini`. 83 markets are still untranslated; run
  `npm run translate:markets` (25 per run) when ready — output is machine-drafted and
  needs native-speaker review.

