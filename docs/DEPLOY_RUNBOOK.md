# DEPLOY RUNBOOK — Railway + Supabase

For the owner. Every step that needs a password, token or secret is typed by you; none of
them is stored in the repository, in `.env.example`, or in any script. Status of this
document: written and checked against the repository and the current Railway and
Supabase docs; **not yet run against the hosted project** (the sandbox has no database
password or access token).

Project facts:

- Supabase project ref: `joritvxmhiwtrnatfphw` (URL `https://joritvxmhiwtrnatfphw.supabase.co`)
- Hosting: one Railway service built from this repository's `Dockerfile` (D-025)
- Public domain: Railway's free `*.up.railway.app` domain (written `<railway-domain>` below)

---

## 0. First: rotate the keys that were shared in chat

The Supabase secret key, the legacy `service_role` JWT and the Turnstile secret were sent in
a chat message. Supabase's guidance is that secret keys must never travel over chat.
Before going live:

1. **Supabase secret key**: Dashboard → Settings → API Keys → create a new secret key →
   update `SUPABASE_SECRET_KEY` in Railway (and in your local `.env.local`) → redeploy →
   delete the old secret key.
2. **Legacy `anon` / `service_role` keys**: the app does not use them (D-021). Dashboard →
   Settings → API Keys → *Disable legacy API keys* (reversible).
3. **Turnstile secret**: Cloudflare → Turnstile → your widget → rotate the secret → paste
   the new secret into Supabase → Auth → Bot and Abuse Protection. (The site key is public;
   it does not need rotating.)
4. **OpenAI key** (old, unused, already deleted from `.env.local`): revoke it in the OpenAI
   dashboard.

---

## 1. Apply the database migrations

You need: a Supabase personal access token and the database password (Dashboard →
Settings → Database). Run on your own machine from the repository root:

```bash
npm ci
npx supabase login                      # paste the access token when asked
npx supabase link --project-ref joritvxmhiwtrnatfphw   # type the DB password when asked
npx supabase db push --dry-run          # lists the migrations that would run
npx supabase db push --include-seed     # applies supabase/migrations/* in order, then seed.sql
```

Migrations, in order (each file starts with its rollback notes):

| File | What it does |
| --- | --- |
| `20261001000100_core_schema.sql` | tables, append-only ledger/orders/audit, wallet balance check |
| `20261001000200_rls.sql` | RLS on every table, SELECT-only policies, no client writes |
| `20261007000100_auth_profiles.sql` | sign-up trigger (profile, wallet, signup credit), `confirm_age()` |
| `20261008000100_auth_hardening.sql` | sign-in rate limiter, owner settings (b = 20,000, max_trade 1,00,000) |
| `20261008000200_read_path.sql` | tags/region, 24 h price/volume functions, Realtime for outcomes |
| `20261008000300_trading.sql` | LMSR functions and `place_order()` |

`--include-seed` runs `supabase/seed.sql` (app settings only; `on conflict do nothing`).

**Do not run `supabase config push`.** It would overwrite the hosted Auth settings (Site
URL, providers, CAPTCHA, templates) with the local `supabase/config.toml` values.

Without the CLI: Dashboard → SQL Editor → run each migration file's contents in the
order above, then `supabase/seed.sql`.

Check: Dashboard → Table Editor shows `markets`, `wallets`, `ledger_entries`…; Database →
Functions shows `place_order`, `confirm_age`, `handle_new_user`.

## 2. Seed the markets (once)

```bash
# Uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY from .env.local or your shell.
npm run db:seed -- --remote
```

It refuses a non-local URL without `--remote`, and `NODE_ENV=production` without
`--yes-production`. It is insert-if-missing: re-running never changes prices, volumes or
edits. Expect `+91 markets, +227 outcomes, +40 translations`. Markets whose catalogue end
date has passed are seeded **closed** (they cannot be traded).

## 3. Supabase Auth URL configuration

Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://<railway-domain>`
- **Redirect URLs**: `https://<railway-domain>/auth/callback`
  (add `http://localhost:3000/auth/callback` only for local development)

Dashboard → Authentication → Emails → Templates: paste `supabase/templates/magic_link.html`
into *Magic Link* and `supabase/templates/confirmation.html` into *Confirm signup*
(subject: "Your BharatPredict sign-in code"). Not needed while `EMAIL_OTP_ENABLED=false`.

### Rate limits: raise the per-IP auth limits

Why: sign-in, the Google code exchange and session refreshes are made by the **server**
(Server Actions, `/auth/callback`, the middleware). Supabase therefore sees Railway's
address for every user, and its per-IP limits — shared by all users — would throttle the
whole site. The app enforces its own per-IP and per-email sign-in limits (D-021).

Dashboard steps (checked against the current Supabase rate-limit docs):

1. Supabase Dashboard → your project → **Authentication** → **Rate Limits**.
2. Raise these per-IP limits (the docs' operation names; defaults in brackets) to cover
   all users at peak, e.g. 10×. Labels on the page may be worded slightly differently:
   - **Sign-ups and sign-ins** (30 per 5 min) — `/auth/v1/otp`, `/signup`, `/user`…
   - **Verification requests** (30 per 5 min) — `/auth/v1/verify`
   - **Token endpoint requests** (150 per 5 min) — `/auth/v1/token`: this covers the
     Google PKCE exchange **and every session refresh by the middleware**, so it matters
     most with Google-only sign-in.
3. Leave **Emails sent** alone until custom SMTP exists (the built-in sender is fixed at 2
   per hour). The per-user OTP resend window (60 s) stays as it is.
4. Click **Save**.

Equivalent Management API calls (your access token is typed in your shell, never
stored). Read the current values first and confirm which `rate_limit_*` field matches
each row above before changing it:

```bash
export SUPABASE_ACCESS_TOKEN=...   # https://supabase.com/dashboard/account/tokens
curl -s "https://api.supabase.com/v1/projects/joritvxmhiwtrnatfphw/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  | jq 'to_entries | map(select(.key | startswith("rate_limit_"))) | from_entries'
curl -X PATCH "https://api.supabase.com/v1/projects/joritvxmhiwtrnatfphw/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"rate_limit_otp": 300, "rate_limit_verify": 300, "rate_limit_token_refresh": 1500}'
```

**Better long-term (backlog, not built):** Supabase supports *IP address forwarding*
(Authentication → Rate Limits → **IP Address Forwarding**): server requests made with a
**secret** key and an `Sb-Forwarded-For` header are rate-limited by the end user's IP.
That needs the auth calls to use a secret-key server client; until then, raise the limits
as above.

## 4. Google OAuth

Google Cloud Console → APIs & Services → Credentials → your OAuth client:

- **Authorized redirect URI**: `https://joritvxmhiwtrnatfphw.supabase.co/auth/v1/callback`
  (Supabase's callback, not the Railway domain)
- **Authorized JavaScript origins**: `https://<railway-domain>`

Supabase → Authentication → Providers → Google: client ID and secret from that client.

## 5. Create the Railway service

1. Railway → New Project → **Deploy from GitHub repo** → this repository.
2. Railway detects the `Dockerfile` and builds with it.
3. Service → Settings → Networking → **Generate Domain** (this is `<railway-domain>`).
4. Service → Settings → Deploy → **Healthcheck Path**: `/api/health` (returns
   `{"ok":true}`, no database call). Leave the start command empty (the image runs
   `node server.js`, which listens on Railway's `PORT` on `0.0.0.0`).
5. Variables (below), then deploy.

### Variables (names only — enter values in Railway, never in the repo)

**Build-time (public, inlined into the browser bundle; changing one needs a redeploy).**
The Dockerfile declares exactly these as `ARG`s, which is how Railway passes variables to a
Dockerfile build:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://joritvxmhiwtrnatfphw.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the `sb_publishable_…` key |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site key |
| `NEXT_PUBLIC_SITE_URL` | `https://<railway-domain>` |
| `EMAIL_OTP_ENABLED` | `false` (until custom SMTP exists) |
| `ALLOW_INDEXING` | `false` (until launch is approved) |

**Runtime only (server secrets; never `NEXT_PUBLIC_`; not ARGs in the Dockerfile):**

| Name | Value |
| --- | --- |
| `SUPABASE_SECRET_KEY` | the new `sb_secret_…` key (step 0) |
| `AUTH_COOKIE_SECRET` | 64 hex characters: `openssl rand -hex 32` |
| `EMAIL_OTP_ENABLED` | same value as above (the server re-checks it at runtime) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | only if you run translations from this service (not needed) |

Optional: `AUTH_RATE_LIMIT_PER_IP`, `AUTH_RATE_LIMIT_PER_EMAIL` (defaults 20 and 5 per 10 min).

## 6. First-deploy QA checklist

- [ ] Deploy log shows "Using detected Dockerfile!" and the healthcheck passed.
- [ ] `https://<railway-domain>/api/health` → `{"ok":true}`.
- [ ] `https://<railway-domain>/robots.txt` → `Disallow: /`; pages carry `noindex`.
- [ ] Home, a category and a market page show markets (not "Markets are unavailable").
- [ ] Response headers include `Content-Security-Policy` with the Supabase URL and
      `challenges.cloudflare.com`; browser console shows no CSP violations.
- [ ] Sign in with Google (tick 18+ first) → returns to the same page, avatar shows,
      header menu shows **Balance ₹10,000.00**.
- [ ] Supabase → Table Editor: `profiles` has the row with `age_confirmed_at` and
      `terms_version`; `ledger_entries` has exactly one `signup_credit`.
- [ ] Place ₹100 on an open market → success toast; dashboard shows the order and the
      position; balance ₹9,900. Reload: still there.
- [ ] A closed market's panel shows "This market is closed for trading".
- [ ] Sign out → avatar gone; `/api/portfolio` → 401.
- [ ] Kill switch test: Supabase SQL editor
      `update app_settings set value='false' where key='trading_enabled';` → an order shows
      "Trading is paused"; set it back to `'true'`.
- [ ] Bundle check (from your machine, after `npm run build` with the same public vars):
      `bash scripts/verify-build.sh .next` passes.

## 7. Rollback

- **App**: Railway → Deployments → pick the last good deployment → *Redeploy*. Variable
  changes also redeploy; revert the variable first if that caused it.
- **Kill switch** (stop all trading immediately, no deploy):
  `update app_settings set value='false' where key='trading_enabled';`
- **Database**: migrations are forward-only in production. Each migration file starts with
  its rollback SQL; run it in the SQL editor only after a backup (Dashboard → Database →
  Backups), and only for the most recent migration. Ledger, orders and audit rows are
  append-only by design and are never deleted.

## 8. Rotating keys later

| Key | Where | Steps |
| --- | --- | --- |
| Supabase secret key | Supabase → API Keys | create new → update Railway `SUPABASE_SECRET_KEY` → redeploy → delete old |
| Publishable key | Supabase → API Keys | create new → update Railway `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → redeploy (it is build-time) → delete old |
| `AUTH_COOKIE_SECRET` | Railway | set a new random value → redeploy (pending Google sign-ins in the last 10 minutes lose their 18+ cookie and are asked again) |
| Turnstile secret | Cloudflare + Supabase | rotate in Cloudflare → paste into Supabase Bot and Abuse Protection |
| Google OAuth secret | Google Cloud + Supabase | create a new secret → paste into Supabase Google provider → delete old |
| Gemini key | Google AI Studio | create new → update where translations run → delete old |

## 9. Incident basics

1. Stop trading with the kill switch if money-like state could be wrong.
2. Check Railway logs and Supabase logs (Auth, Postgres) for the time window.
3. Rotate any key that may have leaked (section 8).
4. Write what happened and what changed in `docs/DECISIONS.md`.
