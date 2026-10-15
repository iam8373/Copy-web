-- =============================================================================
-- 20261011000100_admin_markets.sql — Admin R3: market tags and region.
--
-- Tags drive the category sub-filter chips; region is shown on cards. Kept
-- out of admin_update_market so its field-lock rules stay simple: tags and
-- region never move prices, so they may change in any status before the
-- market is resolved or voided. Moderator or admin, MFA, audited.
--
-- Rollback: drop function if exists public.admin_set_market_tags(uuid, text[], text);
-- =============================================================================

create or replace function public.admin_set_market_tags(p_market_id uuid, p_tags text[], p_region text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   public.profiles%rowtype := public._staff('moderator');
  mkt  public.markets%rowtype;
  new_tags text[];
begin
  select * into mkt from public.markets where id = p_market_id for update;
  if not found then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  if mkt.status in ('resolved', 'voided') then raise exception 'BP_FIELD_LOCKED' using errcode = 'P0001'; end if;
  select coalesce(array_agg(distinct lower(btrim(t))), '{}') into new_tags from unnest(coalesce(p_tags, '{}')) t where btrim(t) <> '';
  if cardinality(new_tags) > 20
     or exists (select 1 from unnest(new_tags) t where t !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(t) > 40)
     or p_region is null or char_length(btrim(p_region)) not between 1 and 40 then
    raise exception 'BP_INVALID_INPUT' using errcode = 'P0001';
  end if;
  update public.markets set tags = new_tags, region = btrim(p_region) where id = p_market_id;
  perform public._audit(me.id, 'market.tags', 'market', p_market_id::text,
    jsonb_build_object('tags', mkt.tags, 'region', mkt.region),
    jsonb_build_object('tags', new_tags, 'region', btrim(p_region)));
end;
$$;

revoke all on function public.admin_set_market_tags(uuid, text[], text) from public, anon, service_role;
grant execute on function public.admin_set_market_tags(uuid, text[], text) to authenticated;
