# DECISIONS

Architecture and product decisions, newest first.

## D-017 — LMSR liquidity default needs an owner decision

**Date:** Backend Phase 1
**Status:** Open

`default_liquidity_b` is 1,000 and `max_trade` is 100,000 credits. With b = 1,000 a single
maximum order on a 50/50 market moves its price to ~100%. `b` should be sized to expected
volume (the market maker's worst-case loss is b·ln(#outcomes), in virtual credits).
Suggested: b ≈ 10,000–50,000 for headline markets, or lower `max_trade`. Admins can set b
per market in Phase 6.

## D-016 — Wallet is an append-only ledger; balance enforced in the database

**Date:** Backend Phase 1
**Status:** Accepted

Balance = Σ ledger_entries.amount. A cached `wallets.balance` is maintained by a BEFORE
INSERT trigger on the ledger and protected by `CHECK (balance >= 0)`, so an overdraft is
impossible regardless of caller (client, service role or SQL function). Ledger, orders,
price history and audit log reject UPDATE/DELETE via triggers that apply to every role.
One `signup_credit` per user is a unique index, not application logic.

Clients never write any table: RLS has SELECT policies only and write privileges are
revoked from `anon`/`authenticated`. All writes go through the service role on the server
or SECURITY DEFINER functions (from Phase 2/4). Admin reads use the service role after a
server-side role check; there is intentionally no "admin can read all" RLS policy.

Units: all money columns are virtual credits (`numeric(18,2)`); shares and LMSR
quantities `numeric(24,8)`; prices `numeric(12,10)`. Nothing is labelled rupees in the DB.

## D-015 — CI is secret-free, least-privilege and SHA-pinned

**Date:** Phase 7
**Status:** Accepted

The workflow reads the repo and nothing else: `contents: read`, no secrets, checkout
without persisted credentials. Third-party actions are pinned to commit SHAs so a moved tag
cannot change what runs. The translation script is never run in CI; CI only validates the
committed translations offline. Build-output guarantees from earlier phases (no test
trigger, no OpenAI, no Google Fonts) are enforced by `scripts/verify-build.sh` rather than
trusted.

## D-014 — Market content: translate once offline, read at runtime

**Date:** Phase 6
**Status:** Accepted

UI chrome stays in `src/i18n`. Market titles and descriptions are translated **once per
market** by `npm run translate:markets` and committed to
`src/data/market-translations.json`. The app only reads that file: zero AI calls at build,
test or page-view time, zero per-user requests.

- **Staleness:** each entry stores `sourceHash` = sha256(title + "\n" + description +
  "\n" + subcategory). The runtime recomputes it with the same sync implementation
  (`src/lib/sha256.ts`) and shows English if it differs, so an edited market can never show
  a translation of its old text.
- **One request, all locales:** one Chat Completions call per market with a strict
  `json_schema`; plain `fetch`, no SDK dependency. The model name comes only from
  `OPENAI_MODEL`; there is no default.
- **Protected terms** (Yes, No, Buy, Sell, Probability, Volume, Market closes, Resolves,
  Liquidity, Position) are defined in the UI dictionaries' `terms` section. The prompt
  requires those exact renderings and the validator rejects anything else.
- **Failure policy:** at most two attempts per market; then the market stays English and
  is reported. A stale entry that fails re-translation is deleted rather than kept.
- **Cost guard:** `--max-markets` (default 25) caps a run; the rest are deferred.
- **Accepted trade-off:** the JSON is bundled into client JS. At 91 markets × 5 locales
  that is roughly 150 KB uncompressed. Split per locale if the catalogue grows.

### Review status — native-speaker review is required before launch

Every generated entry is `"status": "machine-drafted"`, and the market page shows a
"Translated automatically" note in non-English locales. A native speaker must review each
entry before launch. To mark one reviewed, edit its text as needed in
`market-translations.json` and set `"status": "reviewed"`; leave `sourceHash` unchanged.
The script never overwrites a reviewed entry while its hash still matches. If the English
source changes, the entry is re-translated, drops back to `"machine-drafted"`, and needs
review again.

The 8 committed entries were drafted by the coding assistant (no API key was available),
not by the script. They pass `validate.ts` but carry the same review requirement.

## D-013 — One source of truth for order limits, checked twice

**Date:** Phase 5
**Status:** Accepted

`src/lib/trade-limits.ts` owns the limits (₹1 – ₹1,00,000 for the demo). The UI uses it
for attributes, messages and the disabled state; `placeOrder` re-runs `validateAmount`
so a bypassed UI still cannot place an invalid order. A future server route must call the
same function (D-009). Typed values above the max are not clamped silently: clamping would
change what the user asked for without telling them.

## D-012 — Error boundaries never expose internals; test trigger is compiled out

**Date:** Phase 4
**Status:** Accepted

Error UIs show translated copy, a retry and a home link, plus the opaque `digest` when
present. `error.message` and stacks are never rendered or logged by app code.

The only way to exercise the boundary in e2e is `/e2e-error`, gated by a build-time
constant (`NEXT_PUBLIC_E2E_ERROR_TRIGGER`, inlined via `next.config.js` `env`). Normal
builds fold the condition and drop the throwing module entirely. CI checks this by
grepping a normal build for the component (Phase 7). The e2e suite therefore runs against
a production build that differs from the shipped one only by that flag.

## D-011 — Crawling is opt-in and tied to legal review

**Date:** Phase 3
**Status:** Accepted

Indexing is off unless `ALLOW_INDEXING` is exactly `"true"`, which should only be set
after legal review of the compliance pages (still pending — D-008). Off means
`Disallow: /`, an empty sitemap, and `noindex, nofollow` meta on every page; the meta tag
covers crawlers that ignore robots.txt. `/dashboard` and `/profit` are excluded even when
on. The flag is read at build time, so flipping it needs a rebuild.

## D-010 — All fonts are self-hosted

**Date:** Phase 2
**Status:** Accepted

Builds and page views never contact Google Fonts. Fonts are committed under `src/fonts/`
and loaded with `next/font/local`; see `src/fonts/README.md` for sources, versions and
the OFL license.

- Inter was also self-hosted (the work order named only Noto), because it was loaded via a
  CSS `@import` from `fonts.googleapis.com`, which contradicted the phase's acceptance.
- Noto is limited to 400 and 600 as specified; 700 text in Indic locales renders at 600 or
  is synthesised.
- **Accepted residue:** Next.js bundles its internal `GOOGLE_FONT_PROVIDER` string constant
  into framework chunks that App-Router pages do not load. It is inert. Removing it would
  mean patching `node_modules/next`, which is not worth the maintenance cost.

## D-009 — No API surface; rules for any future trading route

**Date:** Phase 1 (second work order)
**Status:** Accepted

`/api/markets`, `/api/markets/[slug]` and `/api/trade` were deleted. Nothing in the app
called them, and `/api/trade` accepted orders with no session, no 18+ check and no
positive-amount check. Market pages read `src/data/` directly at build time, and stored
market translations (Phase 6) are read from committed JSON, so no API is needed.

**Any future server-side trading route must verify the session server-side, enforce the
18+ confirmation, validate the amount, and be rate limited.** A client-supplied session
object or `ageConfirmedAt` is not proof of either; both must come from a server-verified
session. Amount validation must reuse `src/lib/trade-limits.ts` (Phase 5) so client and
server agree.

`api-removed.spec.ts` asserts all three paths return 404, so a route cannot quietly
reappear without failing CI.

## D-007 — E2E runs against a production build in its own distDir

**Date:** Phase E1
**Status:** Accepted

The spec asks for `baseURL http://localhost:3000` and a production `webServer`. In the
Alloy sandbox the dev server must keep owning :3000, so `reuseExistingServer` silently
tested the dev server instead, and building clobbered its `.next`.

`next.config.js` reads `distDir` from `NEXT_DIST_DIR`. `playwright.config.ts` defaults to
:3000 / `.next` (spec-compliant for CI), and `E2E_PORT=3100` switches to a production build
in `.next-e2e`. Side effect: the suite got faster (≈2.7m vs 4.5m) and the dev-compile
flakes disappeared.

## D-008 — Legal review skipped by owner instruction

**Date:** Phases D–E
**Status:** Accepted with risk

The owner explicitly instructed that legal review be skipped for now. Nothing was removed:
every legal page and the auth consent line still carry "Draft — pending legal review", and
the copy still makes no claim that prediction markets are lawful in any Indian state. This
is a launch blocker, not a closed item.

## D-006 — Client-side i18n, no locale-prefixed routes

**Date:** Phase E1
**Status:** Accepted

Locale-prefixed routes would multiply the ~110 statically generated pages by six. A
client-side `LanguageProvider` with typed dictionaries keeps one static build.

- SSR always renders English; the stored locale is applied after mount. Accepted
  trade-off: a brief English flash for non-English users on first paint.
- Toasts are stored as `{titleKey, bodyKey, vars}` because the Zustand store cannot reach
  React context; `Toaster` resolves them at render time, so an open toast re-renders when
  the language changes.
- **Subfilter chips translate display text only.** The English label in `CATEGORIES` stays
  the filter key matched against `market.subcategory` (exposed as `data-filter`); the
  `chips` dictionary section maps it to display text. Filtering, including the Live tab,
  is unchanged. Some game/brand names (CS2, GTA, PUBG, Valorant, OpenAI) stay in Latin
  script.
- Numbers always use Latin digits with `en-IN` grouping and `₹`.
- Legal pages stay English; each dictionary carries a translated
  "English version prevails" notice (`legal.englishPrevails`).
- Every non-English dictionary begins with
  "Machine-drafted — needs native-speaker review before launch".

## D-005 — Positions persist per account in localStorage (demo-grade)

**Date:** Phase C
**Status:** Accepted

Key: `bp-positions:v1:<session.handle>`, with the schema version in the key so a future
shape change can be detected rather than silently mis-parsed. A companion
`bp-seeded:v1:<handle>` flag records that an account has been seeded.

- **Hydration:** reads happen only in `signIn` and `restoreSession` (the latter called
  from a `useEffect` in `LiveTicker`), never during render, so SSR output never depends
  on storage.
- **Seeding:** the demo ledger is injected once, only for an account with no stored data
  and no seeded flag. After that, storage is authoritative — including an empty array.
- **Sign-out:** storage is retained, memory is cleared (`positions: []`). Signing back in
  restores the account's own data; accounts never see each other's.
- **Validation:** `isValidPosition` checks object shape, string ids, finite `shares > 0`,
  `avgPrice` within 0–1, an optional `resolved` of only `won`/`lost`, that `marketId`
  exists in `MARKETS`, and that `outcomeId` exists on that market. Invalid entries are
  dropped individually rather than rejecting the whole array. All access is wrapped in
  try/catch, so unavailable or corrupt storage degrades to in-memory operation.
- **Writes:** on every `placeOrder`, and whenever positions are seeded.

**Supabase migration:** the localStorage key maps to a `positions` table keyed by
`user_id` with RLS restricting rows to their owner; `v1` maps to the first migration. On
first authenticated load the client uploads any local rows once, then treats the server
as authoritative and keeps localStorage purely as an offline cache.

## D-004 — Live market end dates are relative, not hardcoded

**Date:** Phase A
**Status:** Accepted

Hardcoded ISO dates for live markets went stale: the sandbox clock moved from
2026-09-24 to 2026-09-28 mid-session and three live cards began rendering "Closed"
instead of a countdown.

Live seeds now use `inHours(n)` / `inDays(n)` helpers computed from a baseline rounded
to the top of the hour (`BASELINE = floor(Date.now() / HOUR) * HOUR`).

Hydration safety: live cards render the client-only `<Countdown>` (initial state
`--:--`), so no server-rendered date text exists for them. The market detail page does
render `formatEndDate`, but it is a server component passing `market` down as a prop, so
the client uses the server's value. Rounding to the hour additionally means the server
and client module evaluations agree except across an hour boundary.

**Not addressed:** non-live markets still carry absolute dates, several of which are now
in the past because the titles name 2026 events. Fixing this properly means moving the
whole mock calendar forward (or retitling to 2027), which changes content the owner
specified. Flagged, awaiting a decision.

## D-003 — Currency is INR everywhere in the UI

**Date:** Phase A (follow-up fix)
**Status:** Accepted

The trade modal and detail trade panel still read "Amount (USDC)", `$10/$50/$100` and
`$131.58` after the India-first rework. All are now ₹, with presets ₹100/₹500/₹1,000 and
a ₹100–₹10,000 slider. The market-rules copy that described USDC collateral, Venus
Protocol and Chainlink resolution was replaced with rupee-settlement wording, since none
of it applies to this product.

## D-002 — Success animation is driven by store state, not the modal

**Date:** Phase A
**Status:** Accepted

`placeOrder` sets `trade: null` synchronously, so anything rendered inside `TradeModal`
would unmount before it could animate. A separate `lastFill` field plus a standalone
`TradeSuccess` component mounted in the root layout decouples the two. `clearFill` is an
explicit action so the component owns its own dismissal.

## D-001 — Demo-grade persistence, with a Supabase migration planned

**Date:** Pre-existing, documented here
**Status:** Accepted for the demo

Sessions live in `localStorage` under `bp-session`; positions currently live only in
Zustand memory. Phase C will persist positions under
`bp-positions:v1:<session.handle>` with a schema version.

**Future migration (Supabase):** `positions` becomes a table keyed by `user_id` with RLS
so a row is readable only by its owner; the schema version in the localStorage key maps
to a migration number. On first authenticated load the client would upload any
locally-stored positions once, then treat the server as authoritative and keep
localStorage only as an offline cache. Auth moves from the demo modal to Supabase Auth
(phone OTP + Google provider), which removes the self-declared session object entirely.

## Legal status of all placeholder copy

**Draft — pending legal review.** Every legal or compliance string added in Phases D and
E is placeholder copy written by a non-lawyer. Nothing in this repository asserts that
prediction markets are lawful in India or in any Indian state. Availability clauses are
deliberately written as "may be restricted in some states, to be confirmed by qualified
Indian counsel". These pages must not ship without review by an Indian-qualified lawyer.
