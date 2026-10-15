-- =============================================================================
-- 20261014000100_admin_users.sql — Admin R6: users, compliance.
--
-- Emails and sign-in times live in auth.users, which PostgREST does not
-- expose. These read-only functions return them to ADMINS with MFA only
-- (moderators see no personal data). Grievance submission stays a server
-- insert with its own rate limit (no function needed).
--
-- Rollback:
--   drop function if exists public.admin_list_users(text, integer),
--     public.admin_user_detail(uuid), public.admin_compliance();
-- =============================================================================

create or replace function public.admin_list_users(p_search text, p_page integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me   public.profiles%rowtype := public._staff('admin');
  q    text := nullif(btrim(regexp_replace(coalesce(p_search, ''), '[%_\\]', ' ', 'g')), '');
  pg   integer := greatest(coalesce(p_page, 1), 1);
  out  jsonb;
begin
  with matched as (
    select p.id, u.email::text as email, p.handle, p.role, p.status, p.created_at, p.age_confirmed_at,
           u.last_sign_in_at, w.balance
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.wallets w on w.user_id = p.id
     where q is null or u.email ilike '%' || q || '%' or p.handle ilike '%' || q || '%' or p.id::text = q
  )
  select jsonb_build_object(
           'total', (select count(*) from matched),
           'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc)
                               from (select * from matched order by created_at desc limit 50 offset (pg - 1) * 50) r), '[]'::jsonb))
    into out;
  return out;
end;
$$;

create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me  public.profiles%rowtype := public._staff('admin');
  out jsonb;
begin
  select jsonb_build_object(
    'id', p.id, 'email', u.email, 'handle', p.handle, 'role', p.role, 'status', p.status,
    'suspended_reason', p.suspended_reason, 'suspended_at', p.suspended_at,
    'created_at', p.created_at, 'age_confirmed_at', p.age_confirmed_at, 'terms_version', p.terms_version,
    'last_sign_in_at', u.last_sign_in_at,
    'provider', u.raw_app_meta_data ->> 'provider',
    'mfa_factors', (select count(*) from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified'),
    'balance', (select balance from public.wallets where user_id = p.id),
    'orders', (select count(*) from public.orders where user_id = p.id),
    'ledger', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc)
                          from (select id, amount, type, note, created_at from public.ledger_entries
                                 where user_id = p.id order by created_at desc limit 50) l), '[]'::jsonb),
    'positions', coalesce((select jsonb_agg(jsonb_build_object(
                             'market_slug', m.slug, 'market_title', m.title, 'market_status', m.status,
                             'outcome', o.label, 'shares', x.shares, 'avg_price', x.avg_price) order by m.title)
                             from public.positions x
                             join public.markets m on m.id = x.market_id
                             join public.outcomes o on o.id = x.outcome_id
                            where x.user_id = p.id and x.shares > 0), '[]'::jsonb),
    'grievances', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'reference', g.reference, 'subject', g.subject,
                              'status', g.status, 'created_at', g.created_at) order by g.created_at desc)
                              from public.grievances g where g.user_id = p.id), '[]'::jsonb))
    into out
    from public.profiles p join auth.users u on u.id = p.id
   where p.id = p_user_id;
  if out is null then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  return out;
end;
$$;

-- One-page compliance summary (R6). Counts only, plus the staff list.
create or replace function public.admin_compliance()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me  public.profiles%rowtype := public._staff('admin');
  out jsonb;
begin
  select jsonb_build_object(
    'trading_enabled', coalesce((public._setting('trading_enabled') #>> '{}')::boolean, false),
    'two_person', coalesce((public._setting('require_two_person_resolution') #>> '{}')::boolean, false),
    'dispute_window_hours', public._setting('dispute_window_hours'),
    'users', (select count(*) from public.profiles),
    'no_age_confirmation', (select count(*) from public.profiles where age_confirmed_at is null),
    'suspended', (select count(*) from public.profiles where status = 'suspended'),
    'terms_versions', coalesce((select jsonb_object_agg(coalesce(v, 'none'), n)
                                  from (select terms_version v, count(*) n from public.profiles group by terms_version) t), '{}'::jsonb),
    'grievances_open', (select count(*) from public.grievances where status in ('open', 'in_progress')),
    'grievances_unacknowledged_48h', (select count(*) from public.grievances where status = 'open' and created_at < now() - interval '48 hours'),
    'grievances_over_30d', (select count(*) from public.grievances where status in ('open', 'in_progress') and created_at < now() - interval '30 days'),
    'self_approved_30d', (select count(*) from public.resolution_proposals where self_approved and approved_at > now() - interval '30 days'),
    'resolutions_30d', (select count(*) from public.resolution_proposals where status = 'finalized' and finalized_at > now() - interval '30 days'),
    'credits_adjusted_30d', (select coalesce(sum(abs(amount)), 0) from public.ledger_entries where type = 'admin_adjustment' and created_at > now() - interval '30 days'),
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
                         'id', p.id, 'email', u.email, 'role', p.role, 'status', p.status,
                         'mfa', exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified'))
                         order by p.role, u.email)
                         from public.profiles p join auth.users u on u.id = p.id
                        where p.role in ('admin', 'moderator')), '[]'::jsonb))
    into out;
  return out;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.admin_list_users(text,integer)', 'public.admin_user_detail(uuid)', 'public.admin_compliance()'] loop
    execute format('revoke all on function %s from public, anon, service_role', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
