-- =============================================================================
-- 20261001000200_rls.sql
-- Row Level Security. Default deny on every table.
--
--  * Public (anon + authenticated) may READ non-draft markets and their
--    outcomes, price history and translations.
--  * A signed-in user may READ only their own profile, wallet, ledger, orders
--    and positions.
--  * Nobody writes any table from the client. There are no INSERT/UPDATE/
--    DELETE policies, and write privileges are revoked as a second layer.
--    Writes happen only through the service role (server code) or
--    SECURITY DEFINER functions added in later migrations.
--  * Admin reads happen on the server, after a role check, with the service
--    role. There is deliberately no "admins can read everything" policy.
--
-- Rollback: `alter table ... disable row level security` per table and drop the
-- policies below. Not recommended: it exposes every row to the anon key.
-- =============================================================================

-- 1. Enable RLS everywhere (a test asserts no public table is left without it).
alter table public.profiles            enable row level security;
alter table public.markets             enable row level security;
alter table public.outcomes            enable row level security;
alter table public.market_translations enable row level security;
alter table public.wallets             enable row level security;
alter table public.ledger_entries      enable row level security;
alter table public.orders              enable row level security;
alter table public.positions           enable row level security;
alter table public.price_history       enable row level security;
alter table public.audit_log           enable row level security;
alter table public.grievances          enable row level security;
alter table public.app_settings        enable row level security;

-- 2. Privileges. Supabase grants broad privileges to anon/authenticated by
--    default; start from nothing and grant only SELECT where a policy exists.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

-- The service role (server code only) needs full table access; it bypasses RLS
-- by design. Granted explicitly rather than relying on platform defaults.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

grant select on public.markets, public.outcomes, public.price_history, public.market_translations
  to anon, authenticated;
grant select on public.profiles, public.wallets, public.ledger_entries, public.orders, public.positions
  to authenticated;
-- audit_log, grievances, app_settings: no client privileges at all.

-- 3. Public market data (never drafts).
create policy markets_public_read on public.markets
  for select to anon, authenticated
  using (status <> 'draft');

create policy outcomes_public_read on public.outcomes
  for select to anon, authenticated
  using (exists (select 1 from public.markets m where m.id = market_id and m.status <> 'draft'));

create policy price_history_public_read on public.price_history
  for select to anon, authenticated
  using (exists (select 1 from public.markets m where m.id = market_id and m.status <> 'draft'));

create policy market_translations_public_read on public.market_translations
  for select to anon, authenticated
  using (exists (select 1 from public.markets m where m.id = market_id and m.status <> 'draft'));

-- 4. Own rows only. `(select auth.uid())` is evaluated once per query.
create policy profiles_read_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy wallets_read_own on public.wallets
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy ledger_read_own on public.ledger_entries
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy orders_read_own on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy positions_read_own on public.positions
  for select to authenticated
  using (user_id = (select auth.uid()));
