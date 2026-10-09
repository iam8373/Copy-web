-- =============================================================================
-- 20261008000200_read_path.sql — backend Phase B3: markets read from the DB.
--
-- 1. markets.tags / markets.region: the category sub-filter chips match tags,
--    so they move from the static catalogue into the table.
-- 2. outcome_prices_24h_ago(): the reference price for the "pts 24h" change,
--    from price_history (public data, RLS applies: SECURITY INVOKER).
-- 3. market_volume_24h(): traded volume per market over the last 24 hours.
--    Orders are private, so this SECURITY DEFINER function returns only the
--    per-market total, never rows.
-- 4. Realtime: publish outcomes so clients get live price updates.
--
-- Rollback:
--   alter publication supabase_realtime drop table public.outcomes;  (if added)
--   drop function if exists public.outcome_prices_24h_ago(), public.market_volume_24h();
--   alter table public.markets drop column if exists tags, drop column if exists region;
-- =============================================================================

alter table public.markets
  add column if not exists tags text[] not null default '{}'
    check (cardinality(tags) <= 20),
  add column if not exists region text not null default 'India'
    check (char_length(region) between 1 and 40);

-- Latest price at or before 24 h ago; if a series is younger than that, its
-- first point. Outcomes with no history are omitted (the change is then 0).
create or replace function public.outcome_prices_24h_ago()
returns table (outcome_id uuid, price numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (h.outcome_id) h.outcome_id, h.price
    from public.price_history h
   order by h.outcome_id,
            (h.at <= now() - interval '24 hours') desc,
            case when h.at <= now() - interval '24 hours' then h.at end desc nulls last,
            h.at asc;
$$;

revoke all on function public.outcome_prices_24h_ago() from public;
grant execute on function public.outcome_prices_24h_ago() to anon, authenticated, service_role;

create or replace function public.market_volume_24h()
returns table (market_id uuid, volume numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select o.market_id, sum(o.amount)::numeric
    from public.orders o
    join public.markets m on m.id = o.market_id and m.status <> 'draft'
   where o.created_at > now() - interval '24 hours'
   group by o.market_id;
$$;

revoke all on function public.market_volume_24h() from public;
grant execute on function public.market_volume_24h() to anon, authenticated, service_role;

-- Supabase creates the supabase_realtime publication; plain Postgres (the
-- sandbox stand-in) may not have it, so this is conditional.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'outcomes') then
    execute 'alter publication supabase_realtime add table public.outcomes';
  end if;
end;
$$;
