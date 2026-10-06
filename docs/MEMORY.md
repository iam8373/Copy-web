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
- **Palette:** see the colour table in `docs/DESIGN.md` (semantic tokens `brand`,
  `success`, `danger`, `warning`; `accent-*` are aliases). Reuse tokens; do not introduce
  new colours. `tests/e2e/contrast.spec.ts` fails if a change breaks AA.
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

- Work order 1 (A–E) and work order 2 (phases 1–7) complete. 306 e2e tests pass on
  desktop + mobile.
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
- **CI** (Phase 7, D-015): `.github/workflows/ci.yml`. To bump an action, resolve the new
  tag to its commit SHA and keep the `# vX.Y.Z` comment. Lint the workflow with
  `actionlint`. `scripts/verify-build.sh <distDir>` checks a normal build's output.

## Work order 3 — backend (Supabase)

- **Schema** lives only in `supabase/migrations/`; after any change run `npm run db:types`
  and commit `src/types/database.ts`. Tests: `supabase test db` (pgTAP in
  `supabase/tests/`).
- **Never write tables from the client.** RLS is SELECT-only; writes = service role on the
  server or SECURITY DEFINER functions.
- **`legacy_id` / `legacy_key`** map DB rows to the old static ids (`mkt_001`, `yes`).
  Only the seed uses `src/data/markets.ts` going forward (Phase 3 removes runtime use).
- **Sandbox stand-in for `supabase start`:** `supabase start` fails here ("unable to
  derive the IP value for host-gateway") because the sandbox Docker daemon runs with
  `--bridge=none` and cannot be restarted. Instead, containers run with `--network host`:
  `bp-pg` (supabase/postgres 17, port 54322), `bp-rest` (PostgREST, 54330), `bp-kong`
  (Kong, 54321 → `/rest/v1/`). `.scratch/db-apply.sh` = `db reset`. Local JWTs in
  `.scratch/localstack/keys.json`; `.env.local` points at them. GoTrue and Realtime are
  not running yet (Phase 2/3). On a normal machine just use `supabase start`.
- **Supabase CLI** is a downloaded binary in `.scratch/` here, not a project dependency
  (awaiting approval to add `supabase` as a devDependency).

## Design system (work order 4)

- Read `docs/DESIGN.md` before UI work. Only `globals.css`, `tailwind.config.ts` and
  `src/lib/tokens.ts` may contain hex/px; `npm run check:tokens` enforces it.
- Colour vars are RGB channels: use `rgb(var(--x))` in raw CSS, Tailwind classes otherwise.
- **Changing `tailwind.config.ts` needs a dev-server restart** (Tailwind JIT kept serving
  the old config). Restarting the container wipes Playwright's apt libs → rerun
  `npx playwright install-deps chromium`.
- Page check script (scratch): `.scratch/shots.spec.ts` via
  `npx playwright test -c .scratch/shots.config.ts` (both themes, 360/1280, overflow).
- Gemini key is in `.env.local` as `GEMINI_API_KEY`; `GEMINI_MODEL` still blank.
- Phase 1 done. Legacy colour aliases are gone: use `bg-surface-1/2/3`,
  `text-primary/secondary/muted`, `border-subtle/strong`, `brand`, `success/danger/warning`.
  The cleanup codemod (`.scratch/codemod.py`) also rewrites words in comments ("rounded" →
  "rounded-chip"), so check the diff for non-class lines after running it.
- Phase 2 done. Build UI from `@/components/ui` (see DESIGN.md → Components). Gallery at
  `/e2e-ui` (dev + e2e builds only). Any new custom Tailwind token that shares a prefix
  with a default group (`text-*`, `shadow-*`) must also be added to the
  `extendTailwindMerge` config in `src/lib/utils.ts`, or `cn()` will drop classes.
- Phase 3 done. Search options are `role="option"` inside `[data-testid="search-dialog"]`
  (the language `<select>` is also a combobox, so scope queries). Arbitrary `max-[Npx]`
  variants fail check:tokens; add a screen token instead (`xs` = 400px exists).
- Phase 4 done. Market page data only via `src/services/markets/market-data.ts`. Desktop
  amount input is `#detail-amount` (trade panel); the sheet's is `#amount` and on mobile
  the panel is hidden — open the sheet from `[data-testid="mobile-trade-bar"]`. The welcome
  toast is also `role="status"`; assert order toasts by text.
