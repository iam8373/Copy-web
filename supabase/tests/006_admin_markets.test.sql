-- pgTAP: admin R3 — market tags and region. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000dd01', 'mod@tags.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000dd02', 'user@tags.test', 'authenticated', 'authenticated');
update profiles set role = 'moderator' where id = '00000000-0000-0000-0000-00000000dd01';
insert into markets (id, slug, title, category, subcategory, end_date, status, resolved_at) values
  ('50000000-0000-0000-0000-000000000001', 'tags-open', 'Tags open', 'cricket', 'IPL', now() + interval '1 day', 'open', null),
  ('50000000-0000-0000-0000-000000000002', 'tags-voided', 'Tags voided', 'cricket', 'IPL', now() - interval '1 day', 'voided', now());

create function pg_temp.as_user(uid text, aal text default 'aal2') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true) $$;

select ok(not has_function_privilege('anon', 'public.admin_set_market_tags(uuid,text[],text)', 'execute'), 'anon cannot set tags');

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000dd02');
select throws_ok($$select admin_set_market_tags('50000000-0000-0000-0000-000000000001', array['ipl'], 'India')$$, 'P0001', 'BP_FORBIDDEN', 'users cannot set tags');
select pg_temp.as_user('00000000-0000-0000-0000-00000000dd01', 'aal1');
select throws_ok($$select admin_set_market_tags('50000000-0000-0000-0000-000000000001', array['ipl'], 'India')$$, 'P0001', 'BP_MFA_REQUIRED', 'MFA is required');
select pg_temp.as_user('00000000-0000-0000-0000-00000000dd01');
select lives_ok($$select admin_set_market_tags('50000000-0000-0000-0000-000000000001', array[' IPL ', 'india', 'ipl', ''], 'Global')$$, 'a moderator sets tags on an open market');
select throws_ok($$select admin_set_market_tags('50000000-0000-0000-0000-000000000001', array['not a slug'], 'India')$$, 'P0001', 'BP_INVALID_INPUT', 'tags must be slugs');
select throws_ok($$select admin_set_market_tags('50000000-0000-0000-0000-000000000002', array['ipl'], 'India')$$, 'P0001', 'BP_FIELD_LOCKED', 'voided markets are locked');
reset role;
select results_eq($$select tags, region from markets where slug = 'tags-open'$$, $$values (array['india', 'ipl']::text[], 'Global'::text)$$,
  'tags are trimmed, lower-cased and de-duplicated');
select is((select count(*)::int from audit_log where action = 'market.tags' and entity_id = '50000000-0000-0000-0000-000000000001'), 1, 'audited');

select * from finish();
rollback;
