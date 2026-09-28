# MEMORY

Working context for anyone (human or agent) picking this repo up.

## What this is

BharatPredict — an India-first prediction market **UI demo**. Next.js 14 App Router,
TypeScript strict, Tailwind with CSS-variable tokens, Zustand, Recharts, lucide-react.
All data, prices, auth and positions are mocked client-side. No real money, no backend.

## Run it

```bash
docker compose -f docker-compose.alloy.yaml up   # dev server on :3000
npx tsc --noEmit                                  # type-check (no npm script yet — Phase B)
```

Alloy preview proxies :8080 → :3000 (`.alloy/environment.json`).

## Key facts to not re-learn

- **Auth is demo-only.** Phone OTP accepts any 6 digits; Google is a static account
  picker. Session persists in `localStorage` under `bp-session`.
- **Positions are in-memory only** and reset on refresh. Seeded from `SEED_POSITIONS`
  in the store. Phase C fixes this.
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

## These subfilter chips currently render empty pages

`Cricket→T20`, `Politics→BJP`, `Economy→India`, `Sports→Hockey`, `Tech→AI`.
Phase B is meant to seed 1–2 markets each before the category tests can pass.

## Layout map

```
src/app/            routes: /, markets/[category], market/[slug], dashboard, profit, learn, api/*
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

## Running the e2e suite

```bash
npm run typecheck && npm run lint && npm run build   # or: npm run check
npm run test:e2e                                     # both projects
npx playwright test --project=chromium-desktop        # one project
```

**One-time per container:** Playwright needs its browser and system libraries.
`PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright-browsers` is set in the compose file so
the binaries survive container restarts, but the apt libraries do not:

```bash
npx playwright install chromium        # binaries (persisted on the bind mount)
npx playwright install-deps chromium   # system libs (re-run after a container restart)
```

`.playwright-browsers/`, `playwright-report/` and `test-results/` are gitignored.
