-- pgTAP: admin R6 — users list/detail and compliance (admins with MFA only).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000aa001', 'boss@people.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000aa002', 'mod@people.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000aa003', 'findme.unique@people.test', 'authenticated', 'authenticated');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000aa001';
update profiles set role = 'moderator' where id = '00000000-0000-0000-0000-0000000aa002';

create function pg_temp.as_user(uid text, aal text default 'aal2') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true) $$;

select ok(not has_function_privilege('anon', 'public.admin_list_users(text,integer)', 'execute'), 'anon cannot list users');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000aa002');
select throws_ok($$select admin_list_users('', 1)$$, 'P0001', 'BP_FORBIDDEN', 'moderators see no personal data');
select pg_temp.as_user('00000000-0000-0000-0000-0000000aa001', 'aal1');
select throws_ok($$select admin_user_detail('00000000-0000-0000-0000-0000000aa003')$$, 'P0001', 'BP_MFA_REQUIRED', 'MFA required');
select pg_temp.as_user('00000000-0000-0000-0000-0000000aa001');
select is((admin_list_users('findme.unique', 1) ->> 'total')::int, 1, 'search by email');
select is(admin_list_users('findme.unique', 1) -> 'rows' -> 0 ->> 'email', 'findme.unique@people.test', 'emails are returned to admins');
select is((admin_user_detail('00000000-0000-0000-0000-0000000aa003') ->> 'balance')::numeric, 10000.00, 'detail includes the balance');
select throws_ok($$select admin_user_detail('00000000-0000-0000-0000-0000000aa999')$$, 'P0001', 'BP_NOT_FOUND', 'unknown user');
select ok((admin_compliance() -> 'staff') @> '[{"email": "mod@people.test", "mfa": false}]'::jsonb, 'compliance lists staff and their MFA state');
reset role;

select * from finish();
rollback;
