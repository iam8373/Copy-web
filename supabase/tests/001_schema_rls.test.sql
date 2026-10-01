-- pgTAP: schema, RLS and ledger invariants (Phase 1).
-- Run with `supabase test db`. Each file runs inside a transaction that is
-- rolled back, so it never leaves data behind.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(31);

-- ---------------------------------------------------------------- fixtures
-- Two users (A, B), a draft market and an open market with two outcomes.
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000000a', 'a@test.local', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000000b', 'b@test.local', 'authenticated', 'authenticated');
insert into profiles (id, handle) values
  ('00000000-0000-0000-0000-00000000000a', 'user-a'),
  ('00000000-0000-0000-0000-00000000000b', 'user-b');
insert into wallets (user_id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into markets (id, slug, title, category, subcategory, end_date, status) values
  ('10000000-0000-0000-0000-000000000001', 'open-mkt', 'An open market', 'cricket', 'IPL', now() + interval '7 days', 'open'),
  ('10000000-0000-0000-0000-000000000002', 'draft-mkt', 'A draft market', 'cricket', 'IPL', now() + interval '7 days', 'draft');
insert into outcomes (id, market_id, label, sort_order, price) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Yes', 0, 0.5),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'No', 1, 0.5),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Yes', 0, 0.5);
insert into ledger_entries (user_id, amount, type) values
  ('00000000-0000-0000-0000-00000000000a', 500, 'signup_credit'),
  ('00000000-0000-0000-0000-00000000000b', 300, 'signup_credit');

-- --------------------------------------------------------- RLS everywhere
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'every public table has RLS enabled');

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and cmd <> 'SELECT'),
  0, 'there are no INSERT/UPDATE/DELETE policies anywhere');

-- ------------------------------------------------------------ ledger rules
select is((select balance from wallets where user_id = '00000000-0000-0000-0000-00000000000a'),
  500.00::numeric, 'ledger insert updates the cached balance');

select throws_ok(
  $$insert into ledger_entries (user_id, amount, type) values ('00000000-0000-0000-0000-00000000000a', -500.01, 'trade')$$,
  '23514', null, 'a debit larger than the balance is rejected (balance never < 0)');

select is((select balance from wallets where user_id = '00000000-0000-0000-0000-00000000000a'),
  500.00::numeric, 'the rejected debit left the balance unchanged');

select lives_ok(
  $$insert into ledger_entries (user_id, amount, type) values ('00000000-0000-0000-0000-00000000000a', -500, 'trade')$$,
  'a debit down to exactly 0 is allowed');

select throws_ok(
  $$insert into ledger_entries (user_id, amount, type) values ('00000000-0000-0000-0000-00000000000a', 10, 'signup_credit')$$,
  '23505', null, 'the signup credit can only be granted once per user');

select throws_ok(
  $$update ledger_entries set amount = 1 where user_id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'ledger UPDATE is refused, even for the owner role');

select throws_ok(
  $$delete from ledger_entries where user_id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'ledger DELETE is refused, even for the owner role');

select throws_ok(
  $$insert into ledger_entries (user_id, amount, type) values ('00000000-0000-0000-0000-00000000000a', 0, 'trade')$$,
  '23514', null, 'zero-amount ledger entries are rejected');

select is(
  (select bool_and(w.balance = coalesce(l.total, 0))
     from wallets w
     left join (select user_id, sum(amount) total from ledger_entries group by user_id) l using (user_id)),
  true, 'every wallet balance equals the sum of its ledger');

-- ------------------------------------------------------ other append-only
insert into audit_log (action, entity, entity_id) values ('test', 'market', 'x');
select throws_ok($$update audit_log set action = 'tampered'$$, '42501', null, 'audit_log UPDATE is refused');
select throws_ok($$delete from audit_log$$, '42501', null, 'audit_log DELETE is refused');

-- ------------------------------------------------------- constraint checks
select throws_ok(
  $$insert into markets (slug, title, category, subcategory, end_date) values ('bad-cat', 'Bad category', 'culture', 'x', now())$$,
  '23514', null, 'unknown category slugs are rejected');
select throws_ok(
  $$insert into outcomes (market_id, label, sort_order, price) values ('10000000-0000-0000-0000-000000000001', 'Maybe', 2, 1.5)$$,
  '23514', null, 'outcome price must be within 0..1');
select throws_ok(
  $$insert into positions (user_id, market_id, outcome_id, shares) values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 1)$$,
  '23503', null, 'a position cannot reference an outcome from a different market');

-- ------------------------------------------------------- anonymous reader
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*)::int from markets where slug in ('open-mkt', 'draft-mkt')), 1,
  'anon sees only non-draft markets');
select is((select count(*)::int from markets where status = 'draft'), 0, 'anon never sees any draft');
select is((select count(*)::int from outcomes where market_id in ('10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002')), 2, 'anon sees outcomes of non-draft markets only');
select throws_ok($$select * from profiles$$, '42501', null, 'anon cannot read profiles');
select throws_ok($$select * from ledger_entries$$, '42501', null, 'anon cannot read the ledger');
select throws_ok($$select * from app_settings$$, '42501', null, 'anon cannot read app_settings');
select throws_ok(
  $$insert into markets (slug, title, category, subcategory, end_date) values ('x-y', 'Injected', 'cricket', 'x', now())$$,
  '42501', null, 'anon cannot insert markets');
reset role;

-- ----------------------------------------------------------- user A view
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);

select is((select count(*)::int from profiles), 1, 'a user sees exactly one profile: their own');
select is((select handle from profiles), 'user-a', '…and it is theirs');
select is((select count(*)::int from wallets), 1, 'a user sees only their own wallet');
select is(
  (select count(*)::int from ledger_entries where user_id <> '00000000-0000-0000-0000-00000000000a'),
  0, 'a user cannot see another user''s ledger');
select throws_ok(
  $$insert into ledger_entries (user_id, amount, type) values ('00000000-0000-0000-0000-00000000000a', 1000000, 'admin_adjustment')$$,
  '42501', null, 'a user cannot credit their own wallet');
select throws_ok(
  $$update profiles set role = 'admin'$$,
  '42501', null, 'a user cannot promote themselves to admin');
select throws_ok(
  $$update outcomes set price = 0.99$$,
  '42501', null, 'a user cannot move prices directly');
select throws_ok($$select * from audit_log$$, '42501', null, 'a user cannot read the audit log');
reset role;

select * from finish();
rollback;
