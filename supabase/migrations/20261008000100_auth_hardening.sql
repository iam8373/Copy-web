-- =============================================================================
-- 20261008000100_auth_hardening.sql — backend Phase B2.
--
-- 1. rate_limits + hit_rate_limit(): fixed-window counters for sign-in
--    attempts per IP and per email (keys are SHA-256 hashes made by the
--    server; no raw IPs or emails are stored). Only the server (secret key /
--    service_role) can call it.
-- 2. Owner-decided settings: default_liquidity_b = 20,000 (D-017 closed),
--    max_trade = 1,00,000, admin credit cap = 10,000.
--
-- Rollback:
--   drop function if exists public.hit_rate_limit(text, text, integer, integer);
--   drop table if exists public.rate_limits;
--   update public.app_settings set value = '1000' where key = 'default_liquidity_b';
--   alter table public.markets alter column liquidity_b set default 1000;
-- =============================================================================

create table public.rate_limits (
  bucket       text not null check (bucket ~ '^[a-z][a-z0-9_]{1,40}$'),
  key_hash     text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  hits         integer not null default 0 check (hits >= 0),
  primary key (bucket, key_hash, window_start)
);

create index rate_limits_window_idx on public.rate_limits (window_start);

-- Default deny: RLS on, no policies, no client grants.
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
grant all on public.rate_limits to service_role;

-- Counts one hit and reports whether the caller is still within the limit.
-- Fixed windows of p_window_seconds; old windows are pruned opportunistically.
create or replace function public.hit_rate_limit(
  p_bucket text, p_key_hash text, p_limit integer, p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  win  timestamptz;
  n    integer;
begin
  if p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit' using errcode = 'invalid_parameter_value';
  end if;
  win := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits (bucket, key_hash, window_start, hits)
  values (p_bucket, p_key_hash, win, 1)
  on conflict (bucket, key_hash, window_start)
  do update set hits = public.rate_limits.hits + 1
  returning hits into n;

  -- Keep the table small: drop windows older than a day (cheap, indexed).
  delete from public.rate_limits where window_start < now() - interval '1 day';

  return n <= p_limit;
end;
$$;

revoke all on function public.hit_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, text, integer, integer) to service_role;

-- Owner values (work order decisions). Upsert so existing projects get them.
insert into public.app_settings (key, value) values
  ('default_liquidity_b', '20000'::jsonb),
  ('max_trade', '100000'::jsonb),
  ('signup_credit', '10000'::jsonb),
  ('admin_credit_cap', '10000'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

alter table public.markets alter column liquidity_b set default 20000;
