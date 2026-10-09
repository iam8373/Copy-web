# DECISIONS

Architecture and product decisions, newest first.

## D-021 — Phase B2: hosted keys, no demo auth, email codes behind a flag

**Date:** Backend Phase B2 (supersedes the opt-in mode of D-020)
**Status:** Accepted

- **One server key: `SUPABASE_SECRET_KEY` (`sb_secret_…`).** Supabase's current docs
  recommend the new publishable/secret keys and are deprecating the legacy JWT
  `anon`/`service_role` keys by the end of 2026; supabase-js 2.117 supports both. The
  service-role JWT is no longer read anywhere and is not in `.env.example`. The secret
  key is imported only by `src/lib/server/env.ts` and `src/lib/supabase/admin.ts`, both
  `server-only`. Browser code uses only `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  JWT verification uses `getClaims()`, which checks the signature against the
  project's JWKS (asymmetric keys) or the Auth server.
- **Demo auth removed.** No `NEXT_PUBLIC_AUTH_MODE`, no demo Google accounts, no
  `bp-session`; a leftover `bp-session` is deleted on load. Without Supabase
  configuration the sheet says sign-in is unavailable and the app still runs.
- **Email codes are off by default (`EMAIL_OTP_ENABLED=false`).** Supabase's built-in
  sender (checked in the current docs) only delivers to the project's team members and
  is limited to about 2 messages per hour, with no delivery guarantee. Public email
  sign-in therefore needs custom SMTP first. With the flag off the sheet shows Google only
  plus a translated note, and the email Server Actions refuse. The flag is read by the
  sheet at build time and by the server at request time.
- **Sign-in runs through Server Actions** (`src/app/actions/auth.ts` → zod →
  `src/services/auth/server.ts`): email code request/verify, Google start, consent,
  sign-out. Session cookies are written by the `@supabase/ssr` server client. Reads of
  "who is signed in" use `GET /api/session` (no-store) instead of an action, because an
  action on mount re-renders the route and broke error boundaries.
- **Rate limits (server-side):** `hit_rate_limit()` fixed windows per IP and per email
  (defaults 20/IP and 5/email per 10 min; env-tunable), keyed by SHA-256 hashes — no raw
  IPs or emails stored; fails closed. Because the server calls Supabase Auth, Supabase's
  own per-IP limits see the server's address: raise those per-IP limits in the dashboard
  and rely on these app limits plus Turnstile and the per-address 60 s resend window.
- **18+ consent across Google:** a signed (HMAC, `AUTH_COOKIE_SECRET`), httpOnly,
  10-minute cookie scoped to `/auth/callback`, recorded by `confirm_age()` after the code
  exchange. Missing consent blocks orders and opens a re-confirmation dialog that calls
  the server. The DB-level check on orders comes with `place_order` (B4).
- **Turnstile:** plain script, loaded only when a widget mounts (sheet open, email
  route); token reset after each attempt; failures and expiry clear the token.
- **Bundle/secret scans:** tracked files may not contain `sb_secret_…`, any JWT,
  Turnstile secrets, `AIza…` or `sk-…`; browser bundles may not contain secret-key
  shapes, secret variable names, `service_role` or a non-anon JWT.
- **Exposure note:** the owner sent the secret key, the legacy service-role JWT and the
  Turnstile secret in chat. Supabase's guidance is that secret keys must never travel
  over chat. Rotate all three (runbook in docs/DEPLOY_RUNBOOK.md).

## D-020 — Backend Phase 2: how real authentication is wired

**Date:** Backend Phase 2
**Status:** Accepted, partly superseded by D-021 (no demo mode; one secret key)

- **Opt-in mode.** `NEXT_PUBLIC_AUTH_MODE=supabase` plus a URL and publishable (or legacy
  anon) key turns on real sign-in; anything else runs the in-browser demo, so the app
  builds and runs with no secrets and CI's main suite stays offline. Placeholder values
  count as unset. `.alloy/populate-env.sh` copies secrets from the sandbox environment
  into `.env.local` and switches the mode on only when a hosted URL and key are present.
- **Sessions are cookies** (`@supabase/ssr`). `src/middleware.ts` calls
  `auth.getClaims()` on every request to validate and refresh the token and forwards the
  cookies plus the no-store cache headers (per the current Next.js guide; Next 14 still
  uses `middleware.ts`). Server code must verify identity with `getClaims()`, never
  `getSession()`. `src/lib/supabase/server.ts` is `server-only`.
- **Sign-up is one transaction in the database.** An `after insert on auth.users`
  trigger (`handle_new_user`, SECURITY DEFINER, `search_path` pinned, not executable by
  any client role) creates the profile (unique handle from the email), an empty wallet
  and the one-time `signup_credit` ledger entry (amount from `app_settings`, 10,000), and
  audits it. The DB still allows only one signup credit per user.
- **18+ consent** is recorded by `confirm_age(terms_version)` (SECURITY DEFINER, identity
  from `auth.uid()` only, refuses suspended accounts, audited every time). Email OTP
  calls it right after `verifyOtp`; Google sets a session flag before the redirect and
  `AuthSync` records it when the session appears. `TERMS_VERSION` lives in
  `src/lib/legal.ts`. Trading will check `age_confirmed_at` server-side in Phase 4.
- **Google** uses PKCE: `/auth/callback` exchanges the code; `next` must be a same-site
  path (no open redirect); failures land on `/?auth_error=1` with a toast.
- **UI holds no auth logic**: `AuthModal` calls `src/services/auth/client.ts`;
  `AuthSync` mirrors the verified session (and the user's own profile, via RLS) into the
  existing store, so every existing screen keeps working. Suspended users are signed out
  with a message.
- **Turnstile** is the plain script with explicit rendering (no package), shown only when
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set; its token goes to Supabase as `captchaToken`
  and Supabase verifies it with the secret configured in the project.
- **Emails:** `supabase/templates/magic_link.html` and `confirmation.html` show only
  `{{ .Token }}` (no sign-in link). Wired in `config.toml` for `supabase start`; paste
  into the hosted project's templates.
- **Hosted project checklist** (owner, in the Supabase dashboard): Site URL and redirect
  URL `https://<domain>/auth/callback`; Email provider on, OTP length 6, expiry 3600 s;
  both templates; SMTP = Resend (`smtp.resend.com`, port 465, user `resend`, password =
  Resend API key, verified sender domain); Turnstile on with its secret; Google provider
  with the OAuth client (authorised redirect = the project's `/auth/v1/callback`); rate
  limits: keep the defaults (60 s between codes per address, 30 sign-in and 30
  verification requests per 5 min per IP) and set the hourly email cap to what the
  Resend plan allows.
- **Tests:** pgTAP `002_auth_profiles.test.sql` (26 checks); `tests/e2e-auth/` runs the
  real flow against a local Supabase and reads the code from the mail catcher
  (`npm run test:e2e:auth`); CI runs both against `supabase start`.

## D-019 — Sign-in is email OTP + Google only; no phone, no KYC

**Date:** Owner decision, before the admin/resolution work order
**Status:** Accepted — implemented in backend Phase 2 (D-020)

- **Methods:** a 6-digit code sent by email, or Google. Phone/SMS OTP is removed
  completely (AuthModal tab, its strings in all six locales, its tests, the SMS/DLT
  provider variables). No KYC: no identity documents, phone number or date of birth.
- **18+:** the self-declared checkbox stays and gates both routes; `ageConfirmedAt` is
  recorded on the session exactly as before (sessions without it must re-confirm before
  trading). A stored session from the removed phone flow is discarded on load.
- **Supabase Auth (verified against the current docs):**
  - Email OTP shares the Magic Link implementation. The **Magic Link** email template must
    include `{{ .Token }}` so the email shows the code, e.g.
    `<h2>Your BharatPredict code</h2><p>Enter this code: {{ .Token }}</p>`.
  - Client calls: `supabase.auth.signInWithOtp({ email, options: { captchaToken } })`, then
    `supabase.auth.verifyOtp({ email, token, type: "email" })`.
  - Defaults: one request per 60 s per user, codes expire after 1 hour (configurable under
    Auth > Providers > Email; keep it well under a day).
  - **Production email:** a custom SMTP provider (Supabase's built-in sender is for
    development). Provider to be chosen by the owner.
  - **CAPTCHA:** Supabase supports hCaptcha or Cloudflare Turnstile, enabled under Auth >
    Bot and Abuse Protection, with a token from a frontend widget. Both need a new
    dependency (`@hcaptcha/react-hcaptcha` or `@marsidev/react-turnstile`) — owner choice
    and approval required.
  - **Rate limits:** Supabase Auth rate limits (emails sent, OTP verifications) set in the
    project's Auth rate-limit settings, in addition to the 60 s per-user resend window.
  - Google: Supabase Google provider with an OAuth client from Google Cloud.
- The demo modal accepts any 6 digits and sends nothing; it is replaced by the calls above
  in backend Phase 2.

## D-018 — Market translation uses Google Gemini only

**Date:** Work order 4 (after the UI phases); narrowed to Gemini-only by the owner
**Status:** Accepted

`src/services/translation/translate.ts` sends one Gemini `generateContent` request per
market with the system prompt, the user payload and the strict JSON schema
(`generationConfig.responseJsonSchema`). The output goes through `validate.ts` and a single
retry exactly as before. The OpenAI request path, `OPENAI_*` variables and
`TRANSLATION_PROVIDER` were removed.

- Config: `GEMINI_API_KEY` + `GEMINI_MODEL`, both required, no default model. The model id
  is restricted to `[A-Za-z0-9._-]` because it is part of the URL path.
- The key goes in the `x-goog-api-key` header, never the URL. `SAFETY`/blocked responses
  are failures. 429/5xx back off 5 s before the retry; the timeout is 120 s per request.
- Verified live on one market (temp file, not the repo): `gemini-2.5-flash` is no longer
  available to new keys (HTTP 404); `gemini-3.x-flash` returned 503 at the time;
  `gemini-3.1-flash-lite` and `gemini-flash-lite-latest` passed validation first time.
- `scripts/verify-build.sh` fails if a Gemini or OpenAI endpoint or key name reaches the
  app bundle.

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
(email OTP + Google provider, D-019), which removes the self-declared session object entirely.

## Legal status of all placeholder copy

**Draft — pending legal review.** Every legal or compliance string added in Phases D and
E is placeholder copy written by a non-lawyer. Nothing in this repository asserts that
prediction markets are lawful in India or in any Indian state. Availability clauses are
deliberately written as "may be restricted in some states, to be confirmed by qualified
Indian counsel". These pages must not ship without review by an Indian-qualified lawyer.
