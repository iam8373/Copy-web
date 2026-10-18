# LAUNCH CHECKLIST

Every step that is still on the owner, in order. Tick each box only after the "check"
passes. Details live in `docs/DEPLOY_RUNBOOK.md` (§ numbers) and `docs/ADMIN_RUNBOOK.md`.

## Keys and accounts

- [ ] **Rotate everything ever pasted in chat** (§0): Supabase secret key, legacy JWT
      secret / service_role, Turnstile secret, any OpenAI key (revoke). Check: old values
      fail; the app still works with the new ones in Railway.
- [ ] **Gemini key** in Railway (`GEMINI_API_KEY`, `GEMINI_MODEL`) if translations are
      used from the admin. Check: Admin → Translations shows no "not set up" note.
- [ ] `AUTH_COOKIE_SECRET` set (64 hex) in Railway. `CRON_SECRET` only if pg_cron is off.

## Database

- [ ] **Backup before every migration** (§10): `npm run db:backup`. Check: `backups/<time>/`
      has 5 dumps and `sha256sum -c SHA256SUMS` passes; stored privately.
- [ ] **Apply migrations** in order (§1), latest `20261017000100_sell.sql`. Check:
      Database → Functions lists `sell_shares`; Table Editor → `positions` of settled
      markets show `resolved = true`.
- [ ] **Scheduled job** (§1): Integrations → Cron lists `bp-scheduled-jobs`. Check: a
      market past its end date shows *Trading ended* within a minute.
- [ ] **Seed** markets once (§2), then the **first admin**: `npm run admin:grant -- you@… --remote`,
      sign in, enrol the authenticator at `/admin/mfa`.

## Supabase Auth

- [ ] **URL configuration** (§3): Site URL = your domain; redirect URL
      `https://<domain>/auth/callback`.
- [ ] **Rate limits raised** (§3): sign-ups/sign-ins 300, verifications 300, token endpoint
      1,500 per 5 min. Check: Auth logs show no 429s over a busy hour.
- [ ] **JWT signing keys** (§3, after the S3 deploy): migrate → rotate to ES256 → revoke the
      legacy secret after 1 h 15 min. Check: JWKS lists ES256; opening `/admin` logs no
      `/user` call.
- [ ] **Turnstile** secret set in Auth → Bot and Abuse Protection (only matters when email
      codes are on).
- [ ] Email codes stay **off** (`EMAIL_OTP_ENABLED=false`) until custom SMTP exists.

## Google

- [ ] **OAuth consent screen** (§4): app name "BharatPredict", support email, privacy and
      terms URLs on your domain, authorised domain added; **publishing status: In
      production** (in "Testing" only listed test users can sign in). Check: a Google
      account that is not a test user can sign in.
- [ ] Authorised redirect URI = the Supabase callback URL shown in Auth → Providers → Google.

## Railway and domain

- [ ] **Custom domain** (§5): add it in Railway → Networking, create the CNAME + TXT records;
      wait for the certificate. Check: `https://<domain>/api/health` → `{"ok":true}`.
- [ ] `NEXT_PUBLIC_SITE_URL=https://<domain>` (build-time) and redeploy.
- [ ] Not behind Cloudflare proxy? Leave `TRUSTED_CLIENT_IP_HEADER` unset. Proxied by
      Cloudflare? set it to `cf-connecting-ip` (§5, "Client IP").
- [ ] **Uptime check**: any free monitor (e.g. your provider of choice) hitting
      `https://<domain>/api/health` every 1–5 min with alerts to your phone/email.
- [ ] Run the **launch smoke** against the domain: `SMOKE_BASE_URL=https://<domain> npm run test:smoke`
      (read-only, no secrets). Check: all pass on desktop and mobile.

## Content and legal

- [ ] Indian counsel reviews **Terms, Privacy, Responsible play, Grievance**; fill in the
      grievance officer, addresses, response windows and the state-availability list;
      then remove the "Draft — pending legal review" labels.
- [ ] Publish a security contact address (`docs/SECURITY.md`, grievance page).
- [ ] Review the market catalogue: titles, end dates, resolution sources; void or keep as
      drafts any test markets (§11).

## First testers

- [ ] Invite a small group (5–20). Watch Admin → Dashboard and the audit log daily for a
      week; check grievances within 48 h.
- [ ] Clean up test accounts and markets afterwards (§11: suspend / void, never delete
      ledger rows).

## Going public

- [ ] **Indexing flag**: set `ALLOW_INDEXING=true` (build-time) only when the above is done
      and counsel has signed off; redeploy. Check: `/robots.txt` allows `/` but still
      disallows `/admin`, `/dashboard`, `/profit`; page source has no `noindex`.
- [ ] Take a fresh backup the day you go public, then weekly.
