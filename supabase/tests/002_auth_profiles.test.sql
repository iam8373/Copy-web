-- pgTAP: sign-up trigger, signup credit and confirm_age (backend Phase 2).
-- Run with `supabase test db`. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(26);

-- ------------------------------------------------------------ sign-up trigger
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000c1', 'Asha.Rao+promo@Example.com', 'authenticated', 'authenticated',
        '{"provider":"email"}', '{}');

select is((select handle from profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'asha.rao', 'handle comes from the email local part, lower-cased, without +tag');
select is((select role from profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'user', 'new users are plain users');
select is((select status from profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'active', 'new users are active');
select is((select age_confirmed_at from profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  null, 'age is not confirmed by the sign-up itself');
select is((select balance from wallets where user_id = '00000000-0000-0000-0000-0000000000c1'),
  10000.00::numeric, 'wallet starts with the 10,000 signup credit from app_settings');
select is((select count(*)::int from ledger_entries
            where user_id = '00000000-0000-0000-0000-0000000000c1' and type = 'signup_credit'),
  1, 'exactly one signup_credit ledger entry');
select is((select action from audit_log where entity_id = '00000000-0000-0000-0000-0000000000c1'),
  'user_signed_up', 'sign-up is audited');

-- Same local part, different domain: gets a numbered handle.
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000c2', 'asha.rao@gmail.com', 'authenticated', 'authenticated',
        '{"provider":"google"}', '{"full_name":"Asha Rao"}');
select is((select handle from profiles where id = '00000000-0000-0000-0000-0000000000c2'),
  'asha.rao2', 'a colliding handle gets a number');
select is((select display_name from profiles where id = '00000000-0000-0000-0000-0000000000c2'),
  'Asha Rao', 'Google full_name becomes the display name');
select is((select after ->> 'provider' from audit_log where entity_id = '00000000-0000-0000-0000-0000000000c2'),
  'google', 'the audit row records the provider');

-- Junk local part falls back to a safe handle.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000c3', '..@example.com', 'authenticated', 'authenticated');
select is((select handle from profiles where id = '00000000-0000-0000-0000-0000000000c3'),
  'player', 'an unusable local part becomes "player"');

-- A disabled credit grants nothing but the sign-up still works.
update app_settings set value = '0'::jsonb where key = 'signup_credit';
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000c4', 'zero@example.com', 'authenticated', 'authenticated');
select is((select balance from wallets where user_id = '00000000-0000-0000-0000-0000000000c4'),
  0.00::numeric, 'signup_credit = 0 grants nothing');
select is((select count(*)::int from ledger_entries where user_id = '00000000-0000-0000-0000-0000000000c4'),
  0, '…and writes no ledger entry');

select throws_ok(
  $$insert into ledger_entries (user_id, amount, type) values ('00000000-0000-0000-0000-0000000000c1', 5, 'signup_credit')$$,
  '23505', null, 'a second signup credit is refused');

-- ------------------------------------------------------------ privileges
select ok(not has_function_privilege('anon', 'public.confirm_age(text)', 'execute'),
  'anon cannot call confirm_age');
select ok(has_function_privilege('authenticated', 'public.confirm_age(text)', 'execute'),
  'signed-in users can call confirm_age');
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  'nobody can call the trigger function directly');
select ok(not has_function_privilege('authenticated', 'public.unique_handle(text)', 'execute'),
  'unique_handle is internal');

-- ------------------------------------------------------------ confirm_age
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select confirm_age('draft-2026-10')$$, '42501', null,
  'confirm_age needs a signed-in user (auth.uid())');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select confirm_age('DROP TABLE; --')$$, '22023', null, 'a malformed terms version is refused');
select throws_ok($$select confirm_age(null)$$, '22023', null, 'a missing terms version is refused');
select lives_ok($$select confirm_age('draft-2026-10')$$, 'the user confirms they are 18+');
select isnt((select age_confirmed_at from profiles), null, 'age_confirmed_at is set on their own profile');
select is((select terms_version from profiles), 'draft-2026-10', 'the accepted terms version is stored');
select throws_ok($$update profiles set age_confirmed_at = now()$$, '42501', null,
  'the profile cannot be written directly');
reset role;

select is((select count(*)::int from audit_log
            where entity_id = '00000000-0000-0000-0000-0000000000c1' and action = 'age_confirmed'),
  1, 'the confirmation is audited');

select * from finish();
rollback;
