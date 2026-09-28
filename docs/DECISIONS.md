# DECISIONS

Architecture and product decisions, newest first.

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
