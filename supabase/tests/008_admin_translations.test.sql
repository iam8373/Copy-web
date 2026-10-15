-- pgTAP: admin R5 — translations. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000ff01', 'mod@tr.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000ff02', 'u@tr.test', 'authenticated', 'authenticated');
update profiles set role = 'moderator' where id = '00000000-0000-0000-0000-00000000ff01';
insert into markets (id, slug, title, description, category, subcategory, end_date, status) values
  ('70000000-0000-0000-0000-000000000001', 'tr', 'Will Zeta win?', 'Desc', 'sports', 'Football', now() + interval '1 day', 'open');
insert into outcomes (id, market_id, label, sort_order, price) values
  ('70000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-000000000001', 'Yes', 0, 0.5),
  ('70000000-0000-0000-0000-0000000000b1', '70000000-0000-0000-0000-000000000001', 'No', 1, 0.5);

create function pg_temp.as_user(uid text, aal text default 'aal2') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true) $$;

select ok(not has_function_privilege('anon', 'public.admin_save_market_translation(uuid,text,text,text,text)', 'execute'), 'anon cannot save translations');
select ok(not has_function_privilege('authenticated', 'public.market_source_hash(uuid)', 'execute'), 'the hash helper is internal');

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000ff02');
select throws_ok($$select admin_save_market_translation('70000000-0000-0000-0000-000000000001', 'hi', 'x', '', 'reviewed')$$, 'P0001', 'BP_FORBIDDEN', 'users cannot save');
select pg_temp.as_user('00000000-0000-0000-0000-00000000ff01');
select throws_ok($$select admin_save_market_translation('70000000-0000-0000-0000-000000000001', 'fr', 'x', '', 'reviewed')$$, 'P0001', 'BP_INVALID_INPUT', 'only the five locales');
select is(admin_save_market_translation('70000000-0000-0000-0000-000000000001', 'hi', 'ज़ेटा?', 'विवरण', 'reviewed'), true, 'a reviewer saves Hindi');
select is(admin_save_market_translation('70000000-0000-0000-0000-000000000001', 'hi', 'मशीन', '', 'machine-drafted'), false, 'a machine draft does not replace a current reviewed entry');
select is(admin_save_outcome_translation('70000000-0000-0000-0000-0000000000a1', 'hi', 'हाँ', 'machine-drafted'), true, 'outcome labels save');
reset role;
select is((select source_hash from market_translations where market_id = '70000000-0000-0000-0000-000000000001' and locale = 'hi'),
  encode(sha256(convert_to(E'Will Zeta win?\nDesc\nFootball', 'UTF8')), 'hex'), 'the database computes the source hash');
select is((select title from market_translations where market_id = '70000000-0000-0000-0000-000000000001' and locale = 'hi'), 'ज़ेटा?', 'reviewed text kept');
-- English changes: the reviewed entry is stale and a machine draft may replace it.
update markets set title = 'Will Zeta win the cup?' where id = '70000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000ff01');
select is(admin_save_market_translation('70000000-0000-0000-0000-000000000001', 'hi', 'मशीन', '', 'machine-drafted'), true, 'a stale reviewed entry may be redrafted');
-- Daily cap.
reset role;
update app_settings set value = to_jsonb(public.translation_quota_used() + 1) where key = 'daily_translation_cap';
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000ff01');
select is(admin_take_translation_quota('70000000-0000-0000-0000-000000000001'), 0, 'the last unit of today is taken');
select throws_ok($$select admin_take_translation_quota('70000000-0000-0000-0000-000000000001')$$, 'P0001', 'BP_DAILY_CAP', 'then the cap refuses');
reset role;

select * from finish();
rollback;
