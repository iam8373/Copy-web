-- =============================================================================
-- 20261012000100_admin_resolution.sql — Admin R4: payout preview.
--
-- What each possible result would pay, so the reviewer sees the stakes before
-- proposing: per outcome, the holders and the credits a win would pay (1 per
-- share, truncated to the paisa as in _settle), and what a void would refund.
-- Read-only. Staff with MFA only.
--
-- Rollback: drop function if exists public.admin_resolution_preview(uuid);
-- =============================================================================

create or replace function public.admin_resolution_preview(p_market_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me  public.profiles%rowtype := public._staff('moderator');
  out jsonb;
begin
  if not exists (select 1 from public.markets where id = p_market_id) then
    raise exception 'BP_NOT_FOUND' using errcode = 'P0001';
  end if;
  select jsonb_build_object(
    'outcomes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'outcome_id', o.id,
               'holders', (select count(*) from public.positions p where p.outcome_id = o.id and trunc(p.shares, 2) > 0),
               'payout', (select coalesce(sum(trunc(p.shares, 2)), 0) from public.positions p where p.outcome_id = o.id))
             order by o.sort_order)
        from public.outcomes o where o.market_id = p_market_id), '[]'::jsonb),
    'refund_users', (select count(distinct user_id) from public.orders where market_id = p_market_id),
    'refund_total', (select coalesce(sum(amount), 0) from public.orders where market_id = p_market_id))
  into out;
  return out;
end;
$$;

revoke all on function public.admin_resolution_preview(uuid) from public, anon, service_role;
grant execute on function public.admin_resolution_preview(uuid) to authenticated;
