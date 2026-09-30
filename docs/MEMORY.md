# MEMORY

Working context for anyone (human or agent) picking this repo up.

## What this is

BharatPredict — an India-first prediction market **UI demo**. Next.js 14 App Router,
TypeScript strict, Tailwind with CSS-variable tokens, Zustand, Recharts, lucide-react.
All data, prices, auth and positions are mocked client-side. No real money, no backend.

## Run it

```bash
docker compose -f docker-compose.alloy.yaml up   # dev server on :3000
npm run check                                     # typecheck + lint + build
```

Alloy preview proxies :8080 → :3000 (`.alloy/environment.json`).

## Key facts to not re-learn

- **Auth is demo-only.** Phone OTP accepts any 6 digits; Google is a static account
  picker. Session persists in `localStorage` under `bp-session`.
- **Positions persist per account** under `bp-positions:v1:<handle>` (Phase C). Demo
  ledger seeds once per new account. Signed-out users see no positions.
- **Prices jitter every 6s** via `LiveTicker` → `tick()`. Never assert exact prices in
  tests; assert format (₹, %) and counts.
- **Live tab behaviour is frozen** by owner instruction — `isLive` filtering, the
  pulsing Live section, and the Live subfilters must not change.
- **`MarketCard.tsx` and `MarketGrid.tsx` must stay structurally intact.** Data and
  theme may change; structure may not.
- **Category slugs are frozen:** `cricket, politics, entertainment, economy, finance,
  sports, esports, tech, world-news, war, ai` plus the `live` pseudo-category.
- **Subfilter convention:** the first chip in every category is the category name and
  shows everything. Some chips are `isHighlighted` (star + amber) — IPL, World Cup,
  Lok Sabha, State Elections, Bigg Boss, Bollywood, RBI, Budget, Football, Hockey.
- **Palette:** violet `#7C5CFF` primary (`accent-blue` token, historical name),
  `accent-green #16C784`, `accent-red #F6465D`, `accent-yellow #F7A83B`. Reuse tokens;
  do not introduce new colours.
- **Live market dates are relative** (`inHours` / `inDays` in `markets.ts`). Do not
  replace them with literals — that bug has already bitten once.

## Previously empty chips (fixed in Phase B)

`Cricket→T20`, `Politics→BJP`, `Economy→India`, `Sports→Hockey`, `Tech→AI` now have two
seeds each. `categories.spec.ts` fails if any chip ever renders empty again.

## Layout map

```
src/app/            routes: /, markets/[category], market/[slug], dashboard, profit, learn, legal pages (no API — D-009)
src/components/     Header, CategoryNav, BottomNav, MarketCard/Grid, Auth/Trade/Search modals,
                    TradeSuccess, Dashboard/Profit views, Toaster, LiveTicker
src/data/markets.ts 80 seeds → MARKETS, plus buildHistory/buildOrderBook/buildActivity
src/lib/            types.ts (Category union + CATEGORIES nav), utils.ts (₹ lakh/crore
                    formatting), usePortfolio.ts
src/store/          useMarketStore.ts — markets, session, positions, lastFill, toasts
```

## Gotchas hit so far

- `placeOrder` closes the modal synchronously, so any post-order UI must live outside it.
- Zustand store is created at module scope; during SSR it initialises from the server's
  module evaluation, so anything time-derived must be hydration-safe.
- The Next.js client router cache can serve a stale RSC payload after a data edit —
  a hard reload is needed to confirm whether a data bug is real.

## Running checks and the e2e suite

```bash
npm run check                       # typecheck + lint + build (CI / fresh machine)
npm run test:e2e                    # production build on :3000 (CI / fresh machine)

# Inside the Alloy dev container, where the dev server already owns :3000:
NEXT_DIST_DIR=.next-e2e npm run check   # build without clobbering the dev server
npm run test:e2e:sandbox                # = E2E_PORT=3100, prod build in .next-e2e
```

Never run plain `npm run build` inside the dev container — it overwrites the dev
server's `.next` (see "Dev-server gotcha" below).

**Once per container start:** Playwright needs its browser and system libraries.
`PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright-browsers` is set in the compose file so
the binaries survive container restarts, but the apt libraries do not:

```bash
npx playwright install chromium        # binaries (persisted on the bind mount)
npx playwright install-deps chromium   # system libs (re-run after a container restart)
```

`.playwright-browsers/`, `playwright-report/` and `test-results/` are gitignored.

## i18n (Phase E)

- Dictionaries: `src/i18n/{en,hi,mr,bn,ta,te}.ts`. `en.ts` defines the shape; the others
  are typed `Dictionary`, so a missing key is a type error. `i18n.spec.ts` also checks
  key parity at runtime.
- Use `const { t } = useT()` then `t("section", "key", { vars })`. Unknown keys fall back
  to English, then to the key name.
- Stored under `bp-lang`. `LanguageProvider` sets `<html lang>` and `data-script`;
  `globals.css` picks the Noto font via `html[data-script=...]`.
- Toasts are key-based (`titleKey`, `bodyKey`, `vars`) — never pass raw strings.
- Chip filter keys stay English (`data-filter`); only display text is translated.
- Market titles are English; `Market.title_hi?` / `description_hi?` reserved.
- Legal pages are English-only by design.

## Dev-server gotcha (hit twice)

Running `npm run build` inside the dev container overwrites `.next`, after which the dev
server serves a broken Pages-Router fallback (no `lang`, 404 chunks). Fix:
`docker compose -f docker-compose.alloy.yaml restart web` and wait ~45s.

## Status snapshot (end of work order)

- Phases A–E complete. 12 commits. 174 e2e tests pass on desktop + mobile.
- All six locales ship real dictionaries; all non-English ones are machine-drafted.
- Legal review was skipped at the owner's instruction; copy is still flagged draft.
- `git push` has never worked in this sandbox (no GitHub credentials) — commits are local.

## Work order 2

- **No API routes exist** (Phase 1, D-009). Do not add one without server-side session
  verification, the 18+ check, `trade-limits.ts` validation and rate limiting.
- **Fonts are local** (Phase 2, D-010): `src/fonts/fonts.ts` via `next/font/local`. Never
  reintroduce `next/font/google` or a Google Fonts `@import`; `fonts.spec.ts` will fail.
- **Crawling is off by default** (Phase 3, D-011). `ALLOW_INDEXING=true` + rebuild to
  enable; only after legal review.
- **Error UI** (Phase 4, D-012): `app/error.tsx`, `app/global-error.tsx`, per-route
  `loading.tsx`. Test the boundary via `/e2e-error` + `localStorage["bp-e2e-throw"]="1"`;
  only works in builds with `NEXT_PUBLIC_E2E_ERROR_TRIGGER=1` (Playwright sets it).
- **Adding i18n keys:** add the section/keys to `en.ts` and all five other locale files
  (typecheck enforces it). The old `.scratch` generators are gitignored scratch tools.
- **Order limits** (Phase 5, D-013): `src/lib/trade-limits.ts`. Use `<AmountField>` for
  any amount input; never hard-code min/max/step.
- **Market translations** (Phase 6, D-014): read with `useMarketText(market)` /
  `getMarketText(market, locale)` from `@/lib/market-text` — never `market.title`
  directly in UI. Regenerate with `npm run translate:markets` (needs `OPENAI_API_KEY` and
  `OPENAI_MODEL` in `.env.local`); check with `npm run validate:translations`.
  App code must not import `services/translation/{translate,run,store}` (ESLint enforces).
- **Secret scan:** `npm run check:secrets`. Inside the Alloy container, git reports
  "dubious ownership", so the scan fails closed there; run it on the host or in CI.
