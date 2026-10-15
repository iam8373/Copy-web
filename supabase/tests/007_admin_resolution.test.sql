-- pgTAP: admin R4 — payout preview. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(5);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000ee01', 'mod@pv.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000ee02', 'u@pv.test', 'authenticated', 'authenticated');
update profiles set role = 'moderator' where id = '00000000-0000-0000-0000-00000000ee01';
insert into markets (id, slug, title, category, subcategory, end_date, status) values
  ('60000000-0000-0000-0000-000000000001', 'pv', 'Preview', 'cricket', 'IPL', now() - interval '1 hour', 'closed');
insert into outcomes (id, market_id, label, sort_order, price) values
  ('60000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-000000000001', 'Yes', 0, 0.5),
  ('60000000-0000-0000-0000-0000000000b1', '60000000-0000-0000-0000-000000000001', 'No', 1, 0.5);
insert into positions (user_id, market_id, outcome_id, shares, avg_price) values
  ('00000000-0000-0000-0000-00000000ee02', '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-0000000000a1', 10.567, 0.5);
insert into orders (user_id, market_id, outcome_id, amount, shares, avg_price, idempotency_key) values
  ('00000000-0000-0000-0000-00000000ee02', '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-0000000000a1', 5, 10.567, 0.4731, 'pv-order-key-1');

create function pg_temp.as_user(uid text, aal text default 'aal2') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true) $$;

select ok(not has_function_privilege('anon', 'public.admin_resolution_preview(uuid)', 'execute'), 'anon cannot preview');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000ee02');
select throws_ok($$select admin_resolution_preview('60000000-0000-0000-0000-000000000001')$$, 'P0001', 'BP_FORBIDDEN', 'users cannot preview');
select pg_temp.as_user('00000000-0000-0000-0000-00000000ee01');
select is((admin_resolution_preview('60000000-0000-0000-0000-000000000001') -> 'outcomes' -> 0 ->> 'payout')::numeric, 10.56,
  'a Yes win would pay the truncated shares');
select is((admin_resolution_preview('60000000-0000-0000-0000-000000000001') -> 'outcomes' -> 1 ->> 'holders')::int, 0, 'nobody holds No');
select is((admin_resolution_preview('60000000-0000-0000-0000-000000000001') ->> 'refund_total')::numeric, 5.00, 'a void would refund the orders');
reset role;

select * from finish();
rollback;
