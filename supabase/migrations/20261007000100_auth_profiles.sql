-- =============================================================================
-- 20261007000100_auth_profiles.sql — backend Phase 2: real authentication.
--
-- Sign-in is Supabase Auth email OTP or Google (D-019). When auth.users gets a
-- row, this creates the matching profile, an empty wallet and the one-time
-- signup credit, all in the same transaction as the sign-up. The self-declared
-- 18+ confirmation is recorded through confirm_age(), never by a client write.
--
-- Rollback (destroys nothing else):
--   drop trigger if exists on_auth_user_created on auth.users;
--   drop function if exists public.handle_new_user(), public.confirm_age(text),
--     public.unique_handle(text);
-- Existing profiles, wallets and ledger rows stay; remove them by hand only if
-- the users themselves are being deleted.
-- =============================================================================

-- A readable, unique handle from an email address: "Asha.Rao+x@gmail.com" ->
-- "asha.rao", then "asha.rao2", "asha.rao3"… on collision. Never derived from
-- anything the user can change later without going through the app.
create or replace function public.unique_handle(p_email text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  base  text;
  cand  text;
  n     integer := 1;
begin
  base := lower(split_part(coalesce(p_email, ''), '@', 1));
  base := split_part(base, '+', 1);
  base := regexp_replace(base, '[^a-z0-9._]', '', 'g');
  base := trim(both '._' from base);
  base := left(base, 24);
  if char_length(base) < 2 then
    base := 'player';
  end if;

  cand := base;
  while exists (select 1 from public.profiles p where p.handle = cand) loop
    n := n + 1;
    cand := base || n::text;
    if n > 9999 then
      cand := base || substr(md5(random()::text), 1, 6);
      exit when not exists (select 1 from public.profiles p where p.handle = cand);
    end if;
  end loop;
  return cand;
end;
$$;

revoke all on function public.unique_handle(text) from public, anon, authenticated;

-- Runs as the table owner so it can write profiles/wallets/ledger, which no
-- client role can. Fires once per new auth user (email OTP or Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  credit numeric(18, 2);
  name   text;
begin
  name := nullif(left(trim(coalesce(
            new.raw_user_meta_data ->> 'full_name',
            new.raw_user_meta_data ->> 'name', '')), 80), '');

  insert into public.profiles (id, handle, display_name)
  values (new.id, public.unique_handle(new.email), name);

  insert into public.wallets (user_id) values (new.id);

  -- Amount comes from app_settings (seeded at 10,000 play credits). A missing
  -- or non-positive setting grants nothing rather than failing the sign-up.
  select (s.value #>> '{}')::numeric into credit
    from public.app_settings s where s.key = 'signup_credit';
  if credit is not null and credit > 0 then
    insert into public.ledger_entries (user_id, amount, type, note)
    values (new.id, credit, 'signup_credit', 'Welcome credit (virtual play credits)');
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (new.id, 'user_signed_up', 'profile', new.id::text,
          jsonb_build_object('provider', coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
                             'signup_credit', coalesce(credit, 0)));
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The signed-in user confirms they are 18+ and accepts a terms version.
-- Identity comes from auth.uid() only; the client sends just the version.
-- Each call stamps the time again (a new terms version needs a new consent)
-- and leaves an audit row, so the compliance view can show the history.
create or replace function public.confirm_age(p_terms_version text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid  uuid := auth.uid();
  prev public.profiles%rowtype;
  at   timestamptz := now();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  if p_terms_version is null or p_terms_version !~ '^[a-z0-9][a-z0-9.\-]{0,31}$' then
    raise exception 'invalid terms version' using errcode = 'invalid_parameter_value';
  end if;

  select * into prev from public.profiles where id = uid for update;
  if not found then
    raise exception 'no profile for this user' using errcode = 'no_data_found';
  end if;
  if prev.status <> 'active' then
    raise exception 'account suspended' using errcode = 'insufficient_privilege';
  end if;

  update public.profiles
     set age_confirmed_at = at, terms_version = p_terms_version
   where id = uid;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (uid, 'age_confirmed', 'profile', uid::text,
          jsonb_build_object('age_confirmed_at', prev.age_confirmed_at, 'terms_version', prev.terms_version),
          jsonb_build_object('age_confirmed_at', at, 'terms_version', p_terms_version));
  return at;
end;
$$;

revoke all on function public.confirm_age(text) from public, anon;
grant execute on function public.confirm_age(text) to authenticated;
