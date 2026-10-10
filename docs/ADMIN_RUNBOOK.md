# ADMIN RUNBOOK

How BharatPredict is run day to day. Play credits only: no real money anywhere.
Status: the database layer (R1) is done; the `/admin` screens arrive in R2–R6. Until
then every action below exists as a database function and is fully tested, but has no
button yet.

## Roles

| Role | Can |
| --- | --- |
| `moderator` | create and edit **draft** markets, edit wording of open/closed markets, propose resolutions, handle grievances |
| `admin` | everything a moderator can, plus publish and close markets, approve / reject / finalize resolutions, adjust credits, suspend users, change roles, change settings |

Rules enforced in the database, not just the UI:

- **MFA is required.** Every staff action checks that the session is at assurance level
  2 (TOTP). An admin without MFA can read nothing extra and change nothing.
- Staff cannot change their own role, suspend themselves or credit themselves.
- An admin must be demoted before being suspended; the last active admin cannot be demoted.
- Staff cannot trade while `staff_can_trade` is `false` (default).
- Every write appends to `audit_log` with the actor, before and after. It cannot be
  edited or deleted, not even with the secret key.

### The first admin

1. Sign in on the site once with the admin's Google account.
2. On a trusted machine: `npm run admin:grant -- you@example.com --remote`.
3. Sign in again and enrol an authenticator app at `/admin/mfa`.

Later admins and moderators are promoted by an admin (`admin_set_role`).

## Market lifecycle

```
draft ──publish──▶ open ──end date / close──▶ closed ──propose──▶ resolving ──finalize──▶ resolved
                                                  ▲                  │                      or voided
                                                  └──reject/cancel───┘
```

- **Draft**: invisible to the public. Every field can change, including outcomes.
- **Publish** (admin, type the slug): needs a future end date, outcomes, and a resolution source.
- **Open**: tradable. Wording, flags and the end date (to any future time) can change;
  outcomes, type and liquidity cannot (they would move prices).
- **Closed**: automatically when the end date passes (scheduled job, every minute), or
  early by an admin (type the slug).

## Resolving a market

Write the decision so a stranger could check it: what happened, and a link to the source
named in the market's resolution source.

1. **Propose** (moderator or admin): the winning outcome, or **void**, with an evidence
   URL and a note. The market shows *Resolving* and trading is stopped.
2. **Approve** (admin, type the slug). This opens the **dispute window**
   (`dispute_window_hours`, 24 h). The public sees the proposed result and when the
   window ends.
   - With `require_two_person_resolution = false` (current: one admin), the proposer may
     approve. The proposal is marked **self-approved** and the audit log records
     `resolution.approve_self`. Set the flag to `true` once there is a second admin.
3. **Disputes**: anyone can file a grievance (category *resolution*). If a dispute is
   valid, **cancel** the approved proposal with a reason before the window ends; the
   market goes back to *Closed* and can be proposed again.
4. **Finalize**: after the window, the scheduled job finalizes automatically; an admin can
   also do it (type the slug). Payout: **1 credit per winning share**, rounded down to the
   paisa. **Void**: every order on the market is refunded at cost. The database allows one
   payout and one refund per user per market, so finalizing twice is impossible.

Reject a *pending* proposal (with a reason) when it is wrong; the market returns to
*Closed*. Every proposal, including rejected and cancelled ones, stays in the history.

When to void: the event was cancelled or abandoned, the question turned out ambiguous,
or the resolution source no longer exists. Never void because the result is unpopular.

## Credits and users

- **Adjust credits**: a signed amount up to `admin_credit_cap` (10,000) per adjustment,
  with a reason (shown in the user's ledger). A debit cannot take a balance below zero.
- **Suspend**: with a reason. A suspended user cannot trade; positions stay and are paid
  out normally on resolution. **Reinstate** clears the reason.

## Settings

| Key | Current | Notes |
| --- | --- | --- |
| `trading_enabled` | `true` | global kill switch |
| `min_trade` / `max_trade` | 1 / 1,00,000 | per order |
| `signup_credit` | 10,000 | new accounts only |
| `admin_credit_cap` | 10,000 | per adjustment |
| `default_liquidity_b` | 20,000 | new markets |
| `dispute_window_hours` | 24 | 0–720 |
| `require_two_person_resolution` | `false` | single admin |
| `staff_can_trade` | `false` | |
| `daily_translation_cap` | 50 | Gemini calls per day (R5) |

Unknown keys and out-of-range values are refused. Every change is audited.

## Scheduled job

`run_scheduled_jobs()` closes markets past their end date and finalizes approved
resolutions whose window has ended (50 per run). It runs every minute through pg_cron
when the project has it, otherwise through `POST /api/cron` with `CRON_SECRET` (see
`DEPLOY_RUNBOOK.md` §1). A finalize that fails is logged as
`resolution.finalize_failed` in the audit log and retried next minute.

## Grievances

Each grievance gets a reference like `BP-1A2B3C4D`. Statuses: open → in progress →
resolved / closed. Staff notes are internal. Reply by email from the grievance officer's
address and quote the reference.
