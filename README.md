# BharatPredict

India's prediction market — trade the outcome of Indian and global events, priced in ₹.

BharatPredict is an India-first prediction market interface. Cricket sits at the top of the
navigation, elections and RBI policy are first-class categories, volumes are shown in lakh and
crore, and sign-in is an email code or Google rather than a crypto wallet.

> **Demo build.** All market data, prices, positions and authentication are mocked in the
> browser. No funds are custodied, no sign-in email is sent, and no order reaches a real exchange.

## Mission

Most prediction markets are built for a US audience — NFL games, Fed meetings, US elections.
BharatPredict inverts that. The primary surface is Indian events (IPL, Lok Sabha and state
elections, Bollywood box office, the Union Budget, Nifty and Sensex, BGMI), with major global
events covered alongside them. Currency, number formatting, resolution sources and language
options are all India-native.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS with CSS-variable design tokens |
| State | Zustand |
| Charts | Recharts |
| Icons | lucide-react |

## Getting started

```bash
npm install
cp .env.example .env.local   # optional — the app boots without it
npm run dev                  # http://localhost:3000
```

Other scripts:

```bash
npm run build              # production build
npm run start              # serve the production build
npm run typecheck          # tsc --noEmit
npm run lint               # next lint (next/core-web-vitals)
npm run check              # typecheck + lint + build
npm run test:e2e           # Playwright, desktop + Pixel 5, against a production build
npm run test:e2e:sandbox   # same, on :3100 in .next-e2e (when a dev server owns :3000)
npm run validate:translations  # locale key parity + stored market translations (offline)
npm run check:secrets          # fail if an API-key-like string is in a tracked file
npm run check:tokens           # fail on hard-coded hex colours / px outside the token files
npm run translate:markets -- --dry-run   # list markets needing translation (0 API calls)
```

### Real sign-in (Supabase)

The app runs a self-contained demo by default. For real sign-in (6-digit email code +
Google, D-019/D-020):

```bash
npx supabase start                  # local Postgres, Auth and a mail catcher
# put the printed API URL and publishable/anon key in .env.local, then:
NEXT_PUBLIC_AUTH_MODE=supabase npm run dev
npm run test:e2e:auth               # real email-code flow against the local stack
```

Codes sent locally appear in the mail catcher (http://127.0.0.1:54324). The hosted
project's setup (templates, Resend SMTP, Turnstile, Google, rate limits) is listed in
`docs/DECISIONS.md` (D-020).

### Design system

Read [`docs/DESIGN.md`](docs/DESIGN.md) before UI work. In short:

- Tokens live only in `src/app/globals.css`, `tailwind.config.ts` and `src/lib/tokens.ts`
  (`npm run check:tokens` enforces it).
- Build controls from `@/components/ui` (Button, IconButton, Chip, Segmented, Tabs, Badge,
  Card, EmptyState, Tooltip, Dialog, AnimatedNumber). A gallery of all of them is at
  `/e2e-ui` on the dev server.
- Every user-facing string goes into all six locale files.
- Both themes, 360px without horizontal scroll, ≥ 44px touch targets, visible keyboard
  focus, WCAG AA contrast, and nothing moving under `prefers-reduced-motion`. The e2e
  suite checks each of these (see `docs/DESIGN.md` → Enforcement).

### Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`: secret scan,
typecheck, lint, translation validation, build, build-output checks, and the Playwright
suite. It uses no secrets and read-only permissions.

### Market content translations

Market titles and descriptions are translated **once**, offline, and committed to
`src/data/market-translations.json`; the app never calls an AI service. To (re)translate
new or edited markets, put `GEMINI_API_KEY` and `GEMINI_MODEL` (for example
`gemini-3.1-flash-lite`) in `.env.local`. Gemini is the only provider (D-018). Then:

```bash
npm run translate:markets                      # up to 25 markets per run
npm run translate:markets -- --market mkt_004  # one market
npm run translate:markets -- --max-markets 5   # smaller batch
```

Every entry is saved as `machine-drafted` and needs native-speaker review
(see `docs/DECISIONS.md`, D-014).

First-time Playwright setup:

```bash
npx playwright install chromium
npx playwright install-deps chromium   # system libraries (Linux)
```

### Running in Docker (Alloy sandbox)

```bash
docker compose -f docker-compose.alloy.yaml up
```

The compose service uses `network_mode: host` and serves the dev server on port `3000`, which
is what `.alloy/environment.json` points at.

## Environment variables

Everything is mocked today, so no variable is required to boot. `.env.example` documents the
keys the real integrations will need (Supabase, Google OAuth, UPI/payment gateway, live
data feeds) plus the optional `NEXT_DIST_DIR` / `E2E_PORT` testing knobs.

## Project structure

```
src/
├─ app/
│  ├─ page.tsx                  # home feed: featured, popular, live, per-category rows
│  ├─ markets/[category]/       # one route for all 12 category pages (incl. live)
│  ├─ market/[slug]/            # market page: chart, AMM order book, rules, sticky trade panel
│  ├─ dashboard/                # positions, portfolio value, resolved history
│  ├─ profit/                   # realised/unrealised P&L breakdown + chart
│  ├─ learn/                    # Predictions 101 / help
│  ├─ terms/ privacy/ responsible-play/ grievance/   # draft legal pages
├─ components/                  # Header, CategoryNav, BottomNav, MarketCard, modals, views
│  ├─ ui/                       # shared primitives (see docs/DESIGN.md → Components)
│  └─ market/                   # PriceChart, OrderBook
├─ data/markets.ts              # 91 mock markets, all India-tagged
├─ services/markets/            # getPriceHistory / getOrderBook / getMarketActivity
├─ i18n/                        # en (shape) + hi, mr, bn, ta, te; LanguageProvider, useT()
├─ lib/
│  ├─ types.ts                  # Category union, CATEGORIES nav config, subfilter chips
│  ├─ utils.ts                  # ₹ / lakh / crore formatting, date and odds helpers
│  └─ usePortfolio.ts           # joins the position ledger against live prices
└─ store/useMarketStore.ts      # markets, session, positions, toasts, live price ticker
```

## Categories

`Live` · `Cricket` · `Politics` · `Entertainment` · `Economy` · `Finance` · `Sports` ·
`Esports` · `Tech` · `World News` · `War` · `AI`

Each category has its own subfilter chips. By convention the first chip is the category name
itself and shows everything; a few chips are highlighted as priority entry points (IPL and
World Cup under Cricket, Lok Sabha and State Elections under Politics, Bigg Boss and Bollywood
under Entertainment, RBI and Budget under Economy, Football and Hockey under Sports).

## Features

- **Live markets** with a pulsing indicator and a running countdown
- **Binary and multi-outcome cards** — large probability numbers, Yes/No or per-candidate rows
- **Simulated price movement** — odds drift every few seconds and flash green/red on change
- **Quick trade** from any card, plus a sticky trade panel on the market page (a Yes/No
  bar and bottom sheet on phones)
- **Honest order book** — the market maker's quotes for 10/50/100/500 shares with price
  impact, instead of invented bids and asks; the price chart is labelled "Demo data"
- **Auth** via a 6-digit email code or Google (no phone, no KYC), with a required self-declared 18+
  confirmation and a session-aware header avatar
- **Per-account persistence** of positions in `localStorage`, validated on load
- **Dashboard and P&L** — portfolio value, open positions, resolved history, per-market profit
- **Mobile bottom nav** — Home, Dashboard, Profit, and a More sheet with help, legal pages
  and a language selector
- **Six languages** — English, हिन्दी, मराठी, বাংলা, தமிழ், తెలుగు — switchable on desktop
  (header) and mobile (More sheet). Non-English text is machine-drafted.
- **Trade confirmation animation** that respects `prefers-reduced-motion`
- **Legal pages** — `/terms` (18+ eligibility), `/privacy`, `/responsible-play`,
  `/grievance`. All are draft placeholder copy pending legal review.
- **Dark and light themes** persisted to `localStorage`
- **Command palette** search on `Cmd/Ctrl + K` or `Shift + /`

## API

There is no API. The earlier mock routes (`/api/markets`, `/api/markets/[slug]`,
`/api/trade`) were unauthenticated and unused, so they were removed; all data is read
from `src/data/` at build time. See `docs/DECISIONS.md` (D-009) for the rules any future
server-side trading route must follow.

## Roadmap

- Real email-OTP and Google OAuth sessions (Supabase Auth, custom SMTP, CAPTCHA)
- UPI deposits and withdrawals in ₹
- Native-speaker review of all five Indic dictionaries
- Legal review of every policy page by Indian counsel
- Live cricket and market data feeds replacing `src/data/markets.ts`
- Compliance review for state-level real-money gaming rules

## Disclaimer

This repository is a UI demonstration. It is not a real-money platform, not investment advice,
and not an invitation to trade.
