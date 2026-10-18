# ARCHITECTURE

BharatPredict: prediction markets on Indian and world events with **play credits only**
(no real money). Short map of how it fits together; decisions and their reasons are in
`docs/DECISIONS.md` (D-0xx numbers below).

## Pieces

| Piece | What | Where |
| --- | --- | --- |
| Web app | Next.js 14 App Router, TypeScript, Tailwind (tokens in `globals.css`) | `src/` |
| Database + Auth | Supabase: Postgres (RLS everywhere), Auth (Google; email code behind a flag) | `supabase/migrations/` |
| Hosting | Railway, one Docker service (`Dockerfile`, Node 22, standalone output) | D-025 |
| Scheduler | pg_cron in Postgres every minute (`run_scheduled_jobs`); `POST /api/cron` fallback | D-027 |
| Translation | Gemini, server-side, admin-triggered only, capped per day | D-018, D-031, D-033 |
| CI | GitHub Actions: checks + build + build verification + Docker; pgTAP + e2e on a local Supabase | `.github/workflows/ci.yml` |

## Request flow

```
Browser ──► Railway edge (TLS, X-Real-IP) ──► Next.js server
                                              ├─ middleware: refresh session cookie if near expiry (D-036)
                                              ├─ root layout: cached public market catalogue → per-request store (D-035)
                                              ├─ pages / route handlers / Server Actions
                                              └─ Supabase (PostgREST with the user's JWT → RLS; secret key only server-side)
```

- **Reads of public data** (markets, outcomes, prices, translations, public resolutions)
  use the publishable key without a session and are cached with tags (`markets`,
  `prices`, `history:<id>`); writes revalidate them (D-022).
- **Per-user data** (session, wallet, positions, orders, ledger) is never server-rendered:
  the browser fetches it from `GET /api/session` and `GET /api/portfolio` after hydration;
  RLS returns only the caller's rows (D-024, D-035).
- **Live prices:** Supabase Realtime on `outcomes` when available, plus a `/api/prices`
  poll every 20 s and on tab focus.
- **Language:** six locales (`src/i18n`); the `bp-lang` cookie lets the server render the
  first HTML in the saved language (D-035). Market text and outcome labels have saved
  translations shown only while their source hash matches (D-031).

## Money paths (play credits)

All in Postgres functions: `SECURITY DEFINER`, pinned `search_path`, one transaction,
`REVOKE` from public, `GRANT` to the intended role.

| Function | Who | What |
| --- | --- | --- |
| `place_order` | signed-in user | LMSR buy; locks profile, market, wallet; idempotent; limits (D-023) |
| `sell_shares` | signed-in user | LMSR sell-back; never oversells; proceeds rounded down (D-034) |
| `_settle` (via `finalize_resolution` / `run_scheduled_jobs`) | admin / job | payout 1 credit per held winning share, or void = net-cost refund; finalizes positions (D-034) |
| `admin_adjust_credits` | admin + MFA | capped, reasoned ledger entry (D-027) |
| `handle_new_user` | Auth trigger | profile, wallet, one-time signup credit |

The ledger (`ledger_entries`) is append-only; a trigger applies each row to `wallets` and
a CHECK keeps balances ≥ 0. Orders, audit log and price history are append-only too.

## Admin

`/admin` (D-027–D-032): staff roles `moderator` / `admin`, TOTP MFA required (database
checks `aal2` on every write), typed-slug confirmations, everything audited. Admin reads
use the secret key **after** `requireStaff()`; admin writes use the staff member's own
session so the database's checks apply.

## Where to look

| Need | File |
| --- | --- |
| Market reads + caching | `src/services/markets/read.ts` |
| Trading / selling | `src/services/trading/server.ts`, `supabase/migrations/20261017000100_sell.sql` |
| Session handling | `src/middleware.ts`, `src/lib/supabase/{server,session}.ts` |
| Store | `src/store/useMarketStore.ts`, `src/store/MarketStoreProvider.tsx` |
| Admin | `src/app/admin/`, `src/services/admin/` |
| Build checks | `scripts/verify-build.py` (+ `.selftest.sh`) |
| Runbooks | `docs/DEPLOY_RUNBOOK.md`, `docs/ADMIN_RUNBOOK.md`, `docs/LAUNCH_CHECKLIST.md` |
