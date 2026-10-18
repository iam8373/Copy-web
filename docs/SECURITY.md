# SECURITY

How BharatPredict protects accounts, play credits and personal data, and how to report a
problem. Play credits have no cash value, but balances, results and personal data still
deserve real protection.

## Reporting

Email the project owner (address to be published on the grievance page before launch)
with steps to reproduce. Please do not test against other users' accounts or run load
tests against the live site. We aim to acknowledge within 48 hours.

## Model in one paragraph

The browser never holds a secret. The Next.js server holds the Supabase **secret key**
(runtime variable only, never `NEXT_PUBLIC_`, imported only from `server-only` modules),
the Gemini key and the cookie-signing secret. Users act through their own Supabase session
(JWT in an httpOnly cookie managed by `@supabase/ssr`); the database verifies that JWT and
applies **Row Level Security on every table** (default deny). Every write that moves credits
or changes state is a Postgres function with `SECURITY DEFINER`, a pinned `search_path`,
`REVOKE` from public and a `GRANT` to exactly one role.

## Controls

| Area | Control | Reference |
| --- | --- | --- |
| Sign-in | Google OAuth (PKCE); email code only behind `EMAIL_OTP_ENABLED` with custom SMTP; Turnstile on email | D-019, D-021 |
| Sessions | httpOnly cookies; middleware refreshes; server-only decisions use verified claims (`getClaims`), routine reads rely on the DB verifying the JWT | D-036 |
| Authorization | RLS on all tables; no client writes; staff roles checked inside the database | D-020, D-027 |
| Staff | TOTP MFA (`aal2`) required for every staff action; typed-slug confirmation for publish/close/approve/finalize; self-protection (no self role change, no last-admin removal) | D-027, D-028 |
| Money | LMSR functions in one transaction; append-only ledger; balance CHECK ≥ 0; idempotency keys; unique settlement index (no double payout) | D-023, D-034 |
| Abuse | Per-IP / per-email limits (`hit_rate_limit`, fail closed) keyed on Railway's `X-Real-IP` (never `X-Forwarded-For`); 10 orders/min per user; optional daily buy limit | D-021, D-036 |
| Audit | Append-only `audit_log` for every staff action and scheduled job; visible in /admin/audit | D-027 |
| Headers | CSP (self + Supabase + Turnstile), HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer; `/admin` and personal pages `no-store` + `noindex` | D-025, D-028 |
| Build | CI scans tracked files for secret shapes; `verify-build` fails if a secret name or shape, provider code or test-only route reaches the build | D-021, D-033 |
| Translation | Gemini called only from admin-only server code; output validated before saving; daily cap | D-031, D-033 |
| Dependencies | Actions pinned by commit SHA; new dependencies only with owner approval | D-033 |

## Personal data

Stored: email and sign-in method, profile (handle, language, 18+ confirmation time, terms
version), play-credit ledger, orders, positions, grievances, staff audit entries. Not
collected: phone number, date of birth, identity documents. Database dumps
(`npm run db:backup`) contain emails: keep them private (DEPLOY_RUNBOOK §10). Legal copy
(privacy, terms) is **draft pending review by Indian counsel**.

## Known limits

- Until the Supabase project switches to asymmetric JWT signing keys, admin-page checks
  call the Auth server (DEPLOY_RUNBOOK §3).
- Supabase's own per-IP Auth limits see Railway's address; they are raised, not
  per-user (backlog: `Sb-Forwarded-For`).
- No in-app MFA reset (by design); the owner removes factors in Supabase.
- Free plan: no managed backups; take them manually (DEPLOY_RUNBOOK §10).
