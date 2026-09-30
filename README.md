# BharatPredict

India's prediction market — trade the outcome of Indian and global events, priced in ₹.

BharatPredict is an India-first prediction market interface. Cricket sits at the top of the
navigation, elections and RBI policy are first-class categories, volumes are shown in lakh and
crore, and sign-in is mobile-OTP or Google rather than a crypto wallet.

> **Demo build.** All market data, prices, positions and authentication are mocked in the
> browser. No funds are custodied, no OTP is sent, and no order reaches a real exchange.

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
```

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
keys the real integrations will need (OTP provider, Google OAuth, UPI/payment gateway, live
data feeds) plus the optional `NEXT_DIST_DIR` / `E2E_PORT` testing knobs.

## Project structure

```
src/
├─ app/
│  ├─ page.tsx                  # home feed: featured, popular, live, per-category rows
│  ├─ markets/[category]/       # one route for all 12 category pages (incl. live)
│  ├─ market/[slug]/            # market detail: chart, order book, trade panel, activity
│  ├─ dashboard/                # positions, portfolio value, resolved history
│  ├─ profit/                   # realised/unrealised P&L breakdown + chart
│  ├─ learn/                    # Predictions 101 / help
│  ├─ terms/ privacy/ responsible-play/ grievance/   # draft legal pages
├─ components/                  # Header, CategoryNav, BottomNav, MarketCard, modals, views
├─ data/markets.ts              # 91 mock markets, all India-tagged
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
- **Quick trade** from any card, plus a full trade panel on the market detail page
- **Auth** via mobile number + OTP or Google, with a required self-declared 18+
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

- Real OTP and Google OAuth sessions
- UPI deposits and withdrawals in ₹
- Native-speaker review of all five Indic dictionaries
- Legal review of every policy page by Indian counsel
- Live cricket and market data feeds replacing `src/data/markets.ts`
- Compliance review for state-level real-money gaming rules

## Disclaimer

This repository is a UI demonstration. It is not a real-money platform, not investment advice,
and not an invitation to trade.
