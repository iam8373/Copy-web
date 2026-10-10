-- pgTAP: admin and resolution layer (admin phase R1).
-- Run with `supabase test db`. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(92);

-- ---------------------------------------------------------------- fixtures
-- A = admin, A2 = second admin, M = moderator, MS = suspended moderator,
-- U = trader, V = second trader.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000aa01', 'admin@adm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000aa02', 'admin2@adm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000bb01', 'mod@adm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000bb02', 'mods@adm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000cc01', 'u@adm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000cc02', 'v@adm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000cc03', 'Boot@Adm.test', 'authenticated', 'authenticated');
update profiles set age_confirmed_at = now() where id::text like '00000000-0000-0000-0000-0000000%';
update profiles set role = 'admin' where id in ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-00000000aa02');
update profiles set role = 'moderator' where id in ('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-00000000bb02');
update profiles set status = 'suspended' where id = '00000000-0000-0000-0000-00000000bb02';
insert into app_settings (key, value) values ('trading_enabled', 'true') on conflict (key) do update set value = 'true';
update app_settings set value = '24' where key = 'dispute_window_hours';
update app_settings set value = 'false' where key = 'require_two_person_resolution';
update app_settings set value = 'false' where key = 'staff_can_trade';
insert into grievances (id, name, email, subject, message)
  values ('40000000-0000-0000-0000-000000000001', 'Asha', 'asha@adm.test', 'Payout', 'Where is my payout?');

create function pg_temp.as_user(uid text, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true) $$;
create function pg_temp.mid(p_slug text) returns uuid language sql security definer as $$
  select id from public.markets where slug = p_slug $$;
create function pg_temp.oid_of(p_slug text, p_label text) returns uuid language sql security definer as $$
  select o.id from public.outcomes o join public.markets m on m.id = o.market_id where m.slug = p_slug and o.label = p_label $$;
create function pg_temp.bal(uid text) returns numeric language sql security definer as $$
  select balance from public.wallets where user_id = uid::uuid $$;
create function pg_temp.pid(p_slug text, p_status text default null) returns uuid language sql security definer as $$
  select r.id from public.resolution_proposals r join public.markets m on m.id = r.market_id
   where m.slug = p_slug and (p_status is null or r.status = p_status) order by r.created_at desc limit 1 $$;

-- ------------------------------------------------------------- privileges
select ok(not has_function_privilege('anon', 'public.admin_create_market(jsonb)', 'execute'), 'anon cannot call admin functions');
select ok(has_function_privilege('authenticated', 'public.approve_resolution(uuid,text)', 'execute'), 'admin functions are callable with a user session (role checked inside)');
select ok(not has_function_privilege('authenticated', 'public.run_scheduled_jobs()', 'execute'), 'users cannot run the scheduled jobs');
select ok(has_function_privilege('service_role', 'public.run_scheduled_jobs()', 'execute'), 'the server/cron can run the scheduled jobs');
select ok(not has_function_privilege('authenticated', 'public._settle(uuid,uuid)', 'execute')
      and not has_function_privilege('service_role', 'public._settle(uuid,uuid)', 'execute'), 'nobody can call the payout helper directly');
select ok(not has_function_privilege('authenticated', 'public.admin_grant_by_email(text)', 'execute'), 'admin bootstrap is secret-key only');
select ok((select bool_and(c.relrowsecurity) from pg_class c
            where c.oid in ('public.resolution_proposals'::regclass, 'public.outcome_translations'::regclass)),
  'new tables have RLS enabled');

-- ------------------------------------------------------------- access
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc01', 'aal2');
select throws_ok($$select admin_create_market('{"slug":"x-1","title":"Xxx","category":"cricket","subcategory":"IPL","end_date":"2030-01-01"}')$$,
  'P0001', 'BP_FORBIDDEN', 'a plain user is refused');
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa01', 'aal1');
select throws_ok($$select admin_create_market('{"slug":"x-1","title":"Xxx","category":"cricket","subcategory":"IPL","end_date":"2030-01-01"}')$$,
  'P0001', 'BP_MFA_REQUIRED', 'an admin without MFA (aal1) is refused');
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb02', 'aal2');
select throws_ok($$select admin_create_market('{"slug":"x-1","title":"Xxx","category":"cricket","subcategory":"IPL","end_date":"2030-01-01"}')$$,
  'P0001', 'BP_FORBIDDEN', 'a suspended moderator is refused');

-- ------------------------------------------------------------- markets
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb01', 'aal2');
select isnt(admin_create_market(jsonb_build_object('slug', 'adm-bin', 'title', 'Will the admin test pass?',
  'category', 'cricket', 'subcategory', 'IPL', 'end_date', now() + interval '7 days',
  'resolution_source', 'Official scorecard', 'is_binary', true)), null, 'a moderator creates a binary draft');
select isnt(admin_create_market(jsonb_build_object('slug', 'adm-multi', 'title', 'Who wins the test?',
  'category', 'cricket', 'subcategory', 'IPL', 'end_date', now() + interval '7 days',
  'resolution_source', 'Official scorecard', 'is_binary', false, 'outcomes', jsonb_build_array('A', 'B', 'C'))), null,
  'a moderator creates a multi-outcome draft');
select throws_ok($$select admin_create_market(jsonb_build_object('slug', 'adm-bin', 'title', 'Dup', 'category', 'cricket',
  'subcategory', 'IPL', 'end_date', now() + interval '7 days'))$$, 'P0001', 'BP_SLUG_TAKEN', 'slugs are unique');
select throws_ok($$select admin_create_market(jsonb_build_object('slug', 'adm-bad', 'title', 'Bad category', 'category', 'nope',
  'subcategory', 'IPL', 'end_date', now() + interval '7 days'))$$, 'P0001', 'BP_INVALID_INPUT', 'categories are validated');
select throws_ok($$select admin_create_market(jsonb_build_object('slug', 'adm-dup', 'title', 'Dup outcomes', 'category', 'cricket',
  'subcategory', 'IPL', 'end_date', now() + interval '7 days', 'is_binary', false, 'outcomes', jsonb_build_array('A', 'a', 'B')))$$,
  'P0001', 'BP_INVALID_INPUT', 'outcome labels must be distinct');
reset role;
select results_eq($$select label, price from outcomes where market_id = pg_temp.mid('adm-bin') order by sort_order$$,
  $$values ('Yes'::text, 0.5::numeric(12,10)), ('No', 0.5)$$, 'a binary draft gets Yes/No at 50/50');
select is((select count(*)::int from outcomes where market_id = pg_temp.mid('adm-multi')), 3, 'a multi draft gets its 3 outcomes');
set local role anon;
select is((select count(*)::int from markets where slug in ('adm-bin', 'adm-multi')), 0, 'drafts are invisible to the public');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb01', 'aal2');
select throws_ok($$select admin_publish_market(pg_temp.mid('adm-bin'), 'adm-bin')$$, 'P0001', 'BP_FORBIDDEN', 'moderators cannot publish');
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa01', 'aal2');
select throws_ok($$select admin_publish_market(pg_temp.mid('adm-bin'), 'adm-bim')$$, 'P0001', 'BP_CONFIRM_MISMATCH', 'publishing needs the typed slug');
select lives_ok($$select admin_publish_market(pg_temp.mid('adm-bin'), 'adm-bin')$$, 'an admin publishes with the typed slug');
select lives_ok($$select admin_publish_market(pg_temp.mid('adm-multi'), 'adm-multi')$$, 'and the multi market');
select throws_ok($$select admin_update_market(pg_temp.mid('adm-bin'), '{"outcomes":["A","B","C"]}')$$, 'P0001', 'BP_FIELD_LOCKED',
  'outcomes of an open market cannot change');
select throws_ok($$select admin_update_market(pg_temp.mid('adm-bin'), '{"liquidity_b":5000}')$$, 'P0001', 'BP_FIELD_LOCKED',
  'liquidity of an open market cannot change');
select lives_ok($$select admin_update_market(pg_temp.mid('adm-bin'), '{"title":"Will the admin test pass today?"}')$$, 'wording of an open market can change');
reset role;
select is((select status from markets where slug = 'adm-bin'), 'open', 'published market is open');
select is((select count(*)::int from audit_log where entity = 'market' and entity_id = pg_temp.mid('adm-bin')::text
            and action in ('market.create', 'market.publish', 'market.update') and actor_id is not null), 3,
  'create, publish and update are audited with the actor');
select is((select before ->> 'title' from audit_log where action = 'market.update' and entity_id = pg_temp.mid('adm-bin')::text),
  'Will the admin test pass?', 'the audit keeps the value before the change');

-- --------------------------------------------------- staff and trading
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa01', 'aal2');
select throws_ok(format($$select place_order(%L, %L, 100, 'staff-order-key')$$, pg_temp.mid('adm-bin'), pg_temp.oid_of('adm-bin', 'Yes')),
  'P0001', 'BP_STAFF_CANNOT_TRADE', 'staff cannot trade while staff_can_trade is false');
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc01');
select lives_ok(format($$select place_order(%L, %L, 1000, 'u-yes-key-1')$$, pg_temp.mid('adm-bin'), pg_temp.oid_of('adm-bin', 'Yes')),
  'a user buys Yes');
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc02');
select lives_ok(format($$select place_order(%L, %L, 400, 'v-no-key-1')$$, pg_temp.mid('adm-bin'), pg_temp.oid_of('adm-bin', 'No')),
  'another user buys No');
select lives_ok(format($$select place_order(%L, %L, 300, 'v-a-key-1')$$, pg_temp.mid('adm-multi'), pg_temp.oid_of('adm-multi', 'A')),
  'and trades the multi market twice');
select lives_ok(format($$select place_order(%L, %L, 200, 'v-b-key-1')$$, pg_temp.mid('adm-multi'), pg_temp.oid_of('adm-multi', 'B')), '…');

-- ------------------------------------------------------- resolution (win)
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb01', 'aal2');
select throws_ok(format($$select propose_resolution(%L, %L, 'https://example.org/score', 'Yes won')$$, pg_temp.mid('adm-bin'), pg_temp.oid_of('adm-bin', 'Yes')),
  'P0001', 'BP_WRONG_STATUS', 'an open market before its end date cannot be resolved');
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa01', 'aal2');
select lives_ok($$select admin_close_market(pg_temp.mid('adm-bin'), 'adm-bin')$$, 'an admin closes trading early');
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb01', 'aal2');
select throws_ok(format($$select propose_resolution(%L, %L, 'not a url', 'Yes won')$$, pg_temp.mid('adm-bin'), pg_temp.oid_of('adm-bin', 'Yes')),
  'P0001', 'BP_INVALID_INPUT', 'evidence must be a URL');
select isnt(propose_resolution(pg_temp.mid('adm-bin'), pg_temp.oid_of('adm-bin', 'Yes'), 'https://example.org/score', 'Yes won by 5 wickets'),
  null, 'a moderator proposes Yes');
select throws_ok(format($$select propose_resolution(%L, null, 'https://example.org/x', 'Void it')$$, pg_temp.mid('adm-bin')),
  'P0001', 'BP_WRONG_STATUS', 'a market already being resolved cannot get a second proposal');
select pg_temp.as_user('00000000-0000-0000-0000-00000000cc01');
select throws_ok(format($$select place_order(%L, %L, 100, 'u-late-key-1')$$, pg_temp.mid('adm-bin'), pg_temp.oid_of('adm-bin', 'Yes')),
  'P0001', 'BP_MARKET_CLOSED', 'no trading while resolving');
reset role;
select is((select status from markets where slug = 'adm-bin'), 'resolving', 'the market shows as resolving');

-- Two-person rule when switched on: the proposer cannot approve.
update app_settings set value = 'true' where key = 'require_two_person_resolution';
update resolution_proposals set proposed_by = '00000000-0000-0000-0000-00000000aa01' where market_id = pg_temp.mid('adm-bin');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa01', 'aal2');
select throws_ok($$select approve_resolution(pg_temp.pid('adm-bin'), 'adm-bin')$$,
  'P0001', 'BP_SECOND_PERSON_REQUIRED', 'with the two-person rule on, the proposer cannot approve');
reset role;
update app_settings set value = 'false' where key = 'require_two_person_resolution';
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa01', 'aal2');
select throws_ok($$select approve_resolution(pg_temp.pid('adm-bin'), 'adm')$$,
  'P0001', 'BP_CONFIRM_MISMATCH', 'approval needs the typed slug');
select cmp_ok(approve_resolution(pg_temp.pid('adm-bin'), 'adm-bin'),
  '>', now() + interval '23 hours 59 minutes', 'single admin: self-approval opens a 24-hour dispute window');
reset role;
select ok((select self_approved from resolution_proposals where market_id = pg_temp.mid('adm-bin')), 'the proposal records self_approved');
select is((select count(*)::int from audit_log where action = 'resolution.approve_self'), 1, 'the audit log says self-approved');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa01', 'aal2');
select throws_ok($$select finalize_resolution(pg_temp.pid('adm-bin'), 'adm-bin')$$,
  'P0001', 'BP_DISPUTE_WINDOW_OPEN', 'no payout during the dispute window');
reset role;
select is((run_scheduled_jobs() ->> 'finalized')::int, 0, 'the job does not finalize inside the window');
update resolution_proposals set dispute_ends_at = now() - interval '1 minute' where market_id = pg_temp.mid('adm-bin');
create temp table before_bal as select pg_temp.bal('00000000-0000-0000-0000-00000000cc01') as u, pg_temp.bal('00000000-0000-0000-0000-00000000cc02') as v,
  (select trunc(shares, 2) from positions where user_id = '00000000-0000-0000-0000-00000000cc01' and outcome_id = pg_temp.oid_of('adm-bin', 'Yes')) as won;
grant select on before_bal to authenticated;
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa01', 'aal2');
select is((finalize_resolution(pg_temp.pid('adm-bin'), 'adm-bin') ->> 'users')::int, 1,
  'after the window an admin finalizes: one winner paid');
reset role;
select is(pg_temp.bal('00000000-0000-0000-0000-00000000cc01'), (select u + won from before_bal), 'the winner gets 1 credit per share');
select is(pg_temp.bal('00000000-0000-0000-0000-00000000cc02'), (select v from before_bal), 'the loser gets nothing');
select results_eq($$select status, resolved_outcome_id from markets where slug = 'adm-bin'$$,
  format($$values ('resolved'::text, %L::uuid)$$, pg_temp.oid_of('adm-bin', 'Yes')), 'the market is resolved to Yes');
select throws_ok($$select _settle(pg_temp.pid('adm-bin'), null)$$,
  'P0001', 'BP_WRONG_STATUS', 'a finalized proposal cannot pay out twice');
select throws_ok(format($$insert into ledger_entries (user_id, amount, type, ref_id) values ('00000000-0000-0000-0000-00000000cc01', 1, 'payout', %L)$$, pg_temp.mid('adm-bin')),
  '23505', null, 'the ledger allows one payout per user per market');

-- ------------------------------------------------------- void + scheduled job
update markets set end_date = now() - interval '1 minute' where slug = 'adm-multi';
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb01', 'aal2');
select isnt(propose_resolution(pg_temp.mid('adm-multi'), null, 'https://example.org/abandoned', 'Event abandoned'), null,
  'a market past its end date can be proposed void');
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa02', 'aal2');
select lives_ok($$select approve_resolution(pg_temp.pid('adm-multi'), 'adm-multi')$$,
  'another admin approves');
reset role;
select ok(not (select self_approved from resolution_proposals where market_id = pg_temp.mid('adm-multi')), 'not self-approved');
update resolution_proposals set dispute_ends_at = now() - interval '1 minute' where market_id = pg_temp.mid('adm-multi');
create temp table v_before as select pg_temp.bal('00000000-0000-0000-0000-00000000cc02') as v;
grant select on v_before to authenticated;
select is((run_scheduled_jobs() ->> 'finalized')::int, 1, 'the scheduled job finalizes it after the window');
select is(pg_temp.bal('00000000-0000-0000-0000-00000000cc02'), (select v + 500 from v_before), 'a void refunds every order at cost');
select is((select status from markets where slug = 'adm-multi'), 'voided', 'the market is voided');
select is((select after ->> 'by' from audit_log where action = 'resolution.finalize' and entity_id =
            (select id::text from resolution_proposals where market_id = pg_temp.mid('adm-multi'))), 'scheduled job', 'the job is audited');

-- ------------------------------------------------------- reject / cancel / auto-close
insert into markets (slug, title, category, subcategory, end_date, status, resolution_source)
  values ('adm-rej', 'Reject me', 'cricket', 'IPL', now() - interval '1 hour', 'open', 'src');
insert into outcomes (market_id, label, sort_order, price) select pg_temp.mid('adm-rej'), l, n - 1, 0.5
  from unnest(array['Yes', 'No']) with ordinality as t(l, n);
select is((run_scheduled_jobs() ->> 'closed')::int >= 1, true, 'the job closes markets past their end date');
select is((select status from markets where slug = 'adm-rej'), 'closed', 'adm-rej is closed');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa01', 'aal2');
select isnt(propose_resolution(pg_temp.mid('adm-rej'), pg_temp.oid_of('adm-rej', 'No'), 'https://example.org/n', 'No won'), null, 'proposed');
select throws_ok($$select reject_resolution(pg_temp.pid('adm-rej'), '')$$,
  'P0001', 'BP_INVALID_INPUT', 'rejecting needs a reason');
select lives_ok($$select reject_resolution(pg_temp.pid('adm-rej'), 'Wrong source')$$, 'rejected');
select isnt(propose_resolution(pg_temp.mid('adm-rej'), pg_temp.oid_of('adm-rej', 'Yes'), 'https://example.org/y', 'Yes won'), null,
  'the market can be proposed again after a rejection');
select lives_ok($$select approve_resolution(pg_temp.pid('adm-rej', 'pending'), 'adm-rej')$$, 'approved');
select lives_ok($$select reject_resolution(pg_temp.pid('adm-rej', 'approved'), 'Dispute upheld')$$,
  'an approved proposal can be withdrawn during the window');
reset role;
select results_eq($$select status from resolution_proposals where market_id = pg_temp.mid('adm-rej') order by proposed_at, status$$,
  $$values ('cancelled'::text), ('rejected')$$, 'history keeps the rejected and the cancelled proposal');
select is((select status from markets where slug = 'adm-rej'), 'closed', 'the market is back to closed');

-- ------------------------------------------------------- credits, users, settings
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000aa01', 'aal2');
select is(admin_adjust_credits('00000000-0000-0000-0000-00000000cc02', 500, 'Goodwill for outage'),
  (select v + 500 from v_before) + 500, 'an admin adds credits with a reason');
select throws_ok($$select admin_adjust_credits('00000000-0000-0000-0000-00000000cc02', 10000.01, 'Too much')$$, 'P0001', 'BP_INVALID_AMOUNT',
  'adjustments are capped by admin_credit_cap');
select throws_ok($$select admin_adjust_credits('00000000-0000-0000-0000-00000000aa01', 100, 'For me')$$, 'P0001', 'BP_SELF_ACTION',
  'admins cannot credit themselves');
select is(admin_adjust_credits('00000000-0000-0000-0000-00000000cc02', -10000, 'Clawback test'), 100.00, 'an admin debits credits');
select throws_ok($$select admin_adjust_credits('00000000-0000-0000-0000-00000000cc02', -200, 'Take it all')$$, 'P0001', 'BP_INSUFFICIENT_FUNDS',
  'a debit cannot make a balance negative');
select throws_ok($$select admin_set_user_status('00000000-0000-0000-0000-00000000cc02', 'suspended', '')$$, 'P0001', 'BP_INVALID_INPUT',
  'suspending needs a reason');
select lives_ok($$select admin_set_user_status('00000000-0000-0000-0000-00000000cc02', 'suspended', 'Abuse report #12')$$, 'an admin suspends a user');
select throws_ok($$select admin_set_user_status('00000000-0000-0000-0000-00000000aa02', 'suspended', 'Nope nope')$$, 'P0001', 'BP_FORBIDDEN',
  'an admin cannot be suspended (demote first)');
select throws_ok($$select admin_set_role('00000000-0000-0000-0000-00000000aa01', 'user')$$, 'P0001', 'BP_SELF_ACTION', 'no self role change');
select lives_ok($$select admin_set_role('00000000-0000-0000-0000-00000000aa02', 'user')$$, 'an admin demotes another admin');
select throws_ok($$select admin_update_setting('kill_everything', 'true')$$, 'P0001', 'BP_UNKNOWN_SETTING', 'unknown settings are refused');
select throws_ok($$select admin_update_setting('dispute_window_hours', '1000')$$, 'P0001', 'BP_INVALID_INPUT', 'settings are range-checked');
select lives_ok($$select admin_update_setting('dispute_window_hours', '48')$$, 'a valid setting is saved');
select pg_temp.as_user('00000000-0000-0000-0000-00000000bb01', 'aal2');
select lives_ok($$select admin_update_grievance('40000000-0000-0000-0000-000000000001', 'resolved', 'Paid on finalize')$$, 'a moderator handles a grievance');
select throws_ok($$select admin_update_setting('dispute_window_hours', '12')$$, 'P0001', 'BP_FORBIDDEN', 'moderators cannot change settings');
reset role;
select results_eq($$select status, suspended_reason, suspended_at is not null from profiles where id = '00000000-0000-0000-0000-00000000cc02'$$,
  $$values ('suspended'::text, 'Abuse report #12'::text, true)$$, 'suspension records the reason and time');
select is((select value from app_settings where key = 'dispute_window_hours'), '48'::jsonb, 'the setting changed');
select ok((select resolved_at is not null and reference ~ '^BP-[0-9A-F]{8}$' from grievances where id = '40000000-0000-0000-0000-000000000001'),
  'grievances get a reference and a resolved time');

-- ------------------------------------------------------- public history, bootstrap
set local role anon;
select is((select count(*)::int from resolution_proposals where market_id in (pg_temp.mid('adm-bin'), pg_temp.mid('adm-multi'))), 2,
  'the public sees finalized resolutions');
select throws_ok($$select proposed_by from resolution_proposals$$, '42501', null, 'but not who proposed them');
reset role;
set local role service_role;
select is(admin_grant_by_email('boot@adm.TEST'), '00000000-0000-0000-0000-00000000cc03'::uuid, 'admin:grant makes an account admin by email');
reset role;
select is((select role from profiles where id = '00000000-0000-0000-0000-00000000cc03'), 'admin', 'role is admin');

select * from finish();
rollback;
