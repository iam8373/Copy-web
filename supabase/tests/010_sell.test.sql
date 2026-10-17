-- pgTAP: sell-back (phase S1). Run with `supabase test db`. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(59);

-- ---------------------------------------------------------------- fixtures
-- A, B, C, D traders; S suspended; T staff; R rate-limited.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000a0001', 'a@sell.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000a0002', 'b@sell.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000a0003', 'c@sell.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000a0004', 'd@sell.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000a0005', 's@sell.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000a0006', 't@sell.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000a0007', 'r@sell.test', 'authenticated', 'authenticated');
update profiles set age_confirmed_at = now() where id::text like '00000000-0000-0000-0000-0000000a000%';
update profiles set status = 'suspended' where id = '00000000-0000-0000-0000-0000000a0005';
update profiles set role = 'moderator' where id = '00000000-0000-0000-0000-0000000a0006';
update profiles set daily_trade_limit = 50 where id = '00000000-0000-0000-0000-0000000a0002';
insert into app_settings (key, value) values ('trading_enabled', 'true') on conflict (key) do update set value = 'true';
update app_settings set value = 'false' where key = 'staff_can_trade';

insert into markets (id, slug, title, category, subcategory, end_date, status, is_binary, liquidity_b) values
  ('80000000-0000-0000-0000-000000000001', 'sell-rt', 'Round trip', 'cricket', 'IPL', now() + interval '7 days', 'open', true, 20000),
  ('80000000-0000-0000-0000-000000000002', 'sell-closed', 'Closed', 'cricket', 'IPL', now() + interval '7 days', 'open', true, 20000),
  ('80000000-0000-0000-0000-000000000003', 'sell-expired', 'Expired', 'cricket', 'IPL', now() + interval '7 days', 'open', true, 20000),
  ('80000000-0000-0000-0000-000000000004', 'sell-res', 'Resolve', 'cricket', 'IPL', now() + interval '7 days', 'open', true, 20000),
  ('80000000-0000-0000-0000-000000000005', 'sell-void', 'Void', 'cricket', 'IPL', now() + interval '7 days', 'open', true, 20000),
  ('80000000-0000-0000-0000-000000000006', 'sell-dust', 'Dust', 'cricket', 'IPL', now() + interval '7 days', 'open', true, 20000),
  ('80000000-0000-0000-0000-000000000007', 'sell-old', 'Backfill', 'cricket', 'IPL', now() - interval '7 days', 'open', true, 20000);
insert into outcomes (market_id, label, sort_order, price, shares_outstanding)
select m.id, l.label, l.ord - 1, 0.5, 0
  from markets m, unnest(array['Yes', 'No']) with ordinality as l(label, ord)
 where m.slug like 'sell-%';

create function pg_temp.oid_of(p_slug text, p_label text) returns uuid language sql security definer as $$
  select o.id from public.outcomes o join public.markets m on m.id = o.market_id where m.slug = p_slug and o.label = p_label $$;
create function pg_temp.mid(p_slug text) returns uuid language sql security definer as $$
  select id from public.markets where slug = p_slug $$;
create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true) $$;
create function pg_temp.bal(uid text) returns numeric language sql security definer as $$
  select balance from public.wallets where user_id = uid::uuid $$;
create function pg_temp.pos(uid text, p_slug text, p_label text) returns public.positions language sql security definer as $$
  select * from public.positions where user_id = uid::uuid and outcome_id = pg_temp.oid_of(p_slug, p_label) $$;
create function pg_temp.buy(uid text, p_slug text, p_label text, amt numeric, k text) returns jsonb language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  return public.place_order(pg_temp.mid(p_slug), pg_temp.oid_of(p_slug, p_label), amt, k);
end $$;
create function pg_temp.sell(uid text, p_slug text, p_label text, s numeric, k text) returns jsonb language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  return public.sell_shares(pg_temp.mid(p_slug), pg_temp.oid_of(p_slug, p_label), s, k);
end $$;

-- -------------------------------------------------------------- privileges
select ok(not has_function_privilege('anon', 'public.sell_shares(uuid,uuid,numeric,text)', 'execute'), 'anon cannot sell');
select ok(has_function_privilege('authenticated', 'public.sell_shares(uuid,uuid,numeric,text)', 'execute'), 'signed-in users can sell');
select ok(not has_function_privilege('authenticated', 'public._finalize_positions(uuid)', 'execute')
      and not has_function_privilege('service_role', 'public._finalize_positions(uuid)', 'execute'), 'position finalizing is internal');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select sell_shares(pg_temp.mid('sell-rt'), pg_temp.oid_of('sell-rt', 'Yes'), 1, 'anon-sell-key')$$,
  'P0001', 'BP_NOT_SIGNED_IN', 'selling needs a signed-in user');

-- ------------------------------------------------------- round trip (full)
create temp table rt as select (pg_temp.buy('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes', 1000, 'rt-buy-key') ->> 'shares')::numeric as shares;
reset role;
grant select on rt to authenticated;
set local role authenticated;
select throws_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes', (select shares from rt) + 1, 'rt-over-key')$$,
  'P0001', 'BP_INSUFFICIENT_SHARES', 'cannot sell more than held');
select throws_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'No', 1, 'rt-none-key')$$,
  'P0001', 'BP_INSUFFICIENT_SHARES', 'cannot sell an outcome not held');
select throws_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes', 0, 'rt-zero-key')$$,
  'P0001', 'BP_INVALID_AMOUNT', 'zero shares refused');
select throws_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes', 1.000000001, 'rt-prec-key')$$,
  'P0001', 'BP_INVALID_AMOUNT', 'more than 8 decimals refused');
create temp table rt_sale as select pg_temp.sell('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes', (select shares from rt), 'rt-sell-key') as r;
reset role;
select cmp_ok((select (r ->> 'proceeds')::numeric from rt_sale), '<=', 1000::numeric, 'a full round trip never returns more than was paid');
select cmp_ok(1000 - (select (r ->> 'proceeds')::numeric from rt_sale), '<', 0.02, 'the difference is only rounding');
select is((select price from outcomes where id = pg_temp.oid_of('sell-rt', 'Yes')), 0.5::numeric(12,10), 'the price returns to its starting value');
select is((pg_temp.pos('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes')).shares, 0::numeric(24,8), 'the position is closed');
select is((pg_temp.pos('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes')).realized_pnl,
  ((select (r ->> 'proceeds')::numeric from rt_sale) - 1000)::numeric(18,2), 'realized P&L = proceeds - cost');
select is(pg_temp.bal('00000000-0000-0000-0000-0000000a0001'), 9000 + (select (r ->> 'proceeds')::numeric from rt_sale), 'proceeds are credited');
select is((select count(*)::int from ledger_entries where type = 'sale' and ref_id = (select (r ->> 'order_id')::uuid from rt_sale)), 1, 'one sale ledger row');
select results_eq($$select side, realized_pnl is not null from orders where id = (select (r ->> 'order_id')::uuid from rt_sale)$$,
  $$values ('sell'::text, true)$$, 'the order row is a sell with realized P&L');

-- Idempotency.
set local role authenticated;
select is((pg_temp.sell('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes', (select shares from rt), 'rt-sell-key') ->> 'replayed'), 'true',
  'the same key replays the stored sale');
reset role;
select is((select count(*)::int from ledger_entries where type = 'sale' and user_id = '00000000-0000-0000-0000-0000000a0001'), 1, 'a replay credits nothing');
set local role authenticated;
select throws_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes', 1, 'rt-sell-key')$$,
  'P0001', 'BP_IDEMPOTENCY_CONFLICT', 'a reused key with other shares conflicts');
select throws_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes', 1, 'rt-buy-key')$$,
  'P0001', 'BP_IDEMPOTENCY_CONFLICT', 'a buy key cannot be replayed as a sell');
select throws_ok($$select pg_temp.buy('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes', 1000, 'rt-sell-key')$$,
  'P0001', 'BP_IDEMPOTENCY_CONFLICT', 'a sell key cannot be replayed as a buy');

-- ----------------------------------------------------------- partial sell
create temp table ps as select (pg_temp.buy('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes', 1000, 'ps-buy-key') ->> 'shares')::numeric as shares;
reset role;
grant select on ps to authenticated;
create temp table ps_before as select (pg_temp.pos('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes')).avg_price as avg;
grant select on ps_before to authenticated;
set local role authenticated;
create temp table ps_sale as select pg_temp.sell('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes', trunc((select shares from ps) / 2, 8), 'ps-sell-key') as r;
reset role;
select is((pg_temp.pos('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes')).avg_price, (select avg from ps_before), 'average price unchanged on the remainder');
select is((select (r ->> 'realized_pnl')::numeric from ps_sale),
  (select (r ->> 'proceeds')::numeric from ps_sale) - round((select avg from ps_before) * trunc((select shares from ps) / 2, 8), 2),
  'realized = proceeds - avg_price x shares sold');
set local role authenticated;
select throws_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes', 0.5, 'ps-tiny-key')$$,
  'P0001', 'BP_SELL_TOO_SMALL', 'a partial sale under 1 credit is refused');

-- ------------------------------------------------------------- dust close
reset role;
insert into positions (user_id, market_id, outcome_id, shares, avg_price)
values ('00000000-0000-0000-0000-0000000a0004', pg_temp.mid('sell-dust'), pg_temp.oid_of('sell-dust', 'Yes'), 0.00000100, 0.5);
update outcomes set shares_outstanding = 0.00000100 where id = pg_temp.oid_of('sell-dust', 'Yes');
create temp table dust_before as select pg_temp.bal('00000000-0000-0000-0000-0000000a0004') as b,
  (select count(*) from ledger_entries where user_id = '00000000-0000-0000-0000-0000000a0004') as n;
grant select on dust_before to authenticated;
set local role authenticated;
select throws_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0004', 'sell-dust', 'Yes', 0.00000050, 'dust-part-key')$$,
  'P0001', 'BP_SELL_TOO_SMALL', 'a partial dust sale is refused');
select is((pg_temp.sell('00000000-0000-0000-0000-0000000a0004', 'sell-dust', 'Yes', 0.00000100, 'dust-all-key') ->> 'proceeds')::numeric, 0.00,
  'closing a whole dust position pays 0.00');
reset role;
select is(pg_temp.bal('00000000-0000-0000-0000-0000000a0004'), (select b from dust_before), 'the dust close credits nothing');
select is((select count(*) from ledger_entries where user_id = '00000000-0000-0000-0000-0000000a0004'), (select n from dust_before), 'and writes no ledger row');
select is((select count(*)::int from orders where user_id = '00000000-0000-0000-0000-0000000a0004' and side = 'sell' and amount = 0), 1, 'but records the order');

-- ----------------------------------------------------------------- gates
create temp table gate as select (pg_temp.buy('00000000-0000-0000-0000-0000000a0003', 'sell-closed', 'Yes', 100, 'gate-buy-1')->>'shares')::numeric as s1,
  (pg_temp.buy('00000000-0000-0000-0000-0000000a0003', 'sell-expired', 'Yes', 100, 'gate-buy-2')->>'shares')::numeric as s2;
update markets set status = 'closed' where slug = 'sell-closed';
update markets set end_date = now() - interval '1 minute' where slug = 'sell-expired';
set local role authenticated;
select throws_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0003', 'sell-closed', 'Yes', 10, 'gate-sell-1')$$, 'P0001', 'BP_MARKET_CLOSED', 'no selling after close');
select throws_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0003', 'sell-expired', 'Yes', 10, 'gate-sell-2')$$, 'P0001', 'BP_MARKET_CLOSED', 'no selling after the end date');
reset role;
update app_settings set value = 'false' where key = 'trading_enabled';
set local role authenticated;
select throws_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0001', 'sell-rt', 'Yes', 10, 'gate-sell-3')$$, 'P0001', 'BP_TRADING_DISABLED', 'no selling while trading is paused');
reset role;
update app_settings set value = 'true' where key = 'trading_enabled';
insert into positions (user_id, market_id, outcome_id, shares, avg_price) values
  ('00000000-0000-0000-0000-0000000a0005', pg_temp.mid('sell-rt'), pg_temp.oid_of('sell-rt', 'No'), 10, 0.5),
  ('00000000-0000-0000-0000-0000000a0006', pg_temp.mid('sell-rt'), pg_temp.oid_of('sell-rt', 'No'), 10, 0.5);
update outcomes set shares_outstanding = shares_outstanding + 20 where id = pg_temp.oid_of('sell-rt', 'No');
set local role authenticated;
select throws_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0005', 'sell-rt', 'No', 5, 'gate-sell-4')$$, 'P0001', 'BP_ACCOUNT_SUSPENDED', 'suspended users cannot sell');
select throws_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0006', 'sell-rt', 'No', 5, 'gate-sell-5')$$, 'P0001', 'BP_STAFF_CANNOT_TRADE', 'staff cannot sell');

-- Daily limit: buys only.
select lives_ok($$select pg_temp.buy('00000000-0000-0000-0000-0000000a0002', 'sell-rt', 'No', 50, 'dl-buy-1')$$, 'a buy within the daily limit');
select throws_ok($$select pg_temp.buy('00000000-0000-0000-0000-0000000a0002', 'sell-rt', 'No', 1, 'dl-buy-2')$$, 'P0001', 'BP_DAILY_LIMIT', 'the next buy hits the limit');
select lives_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0002', 'sell-rt', 'No', 40, 'dl-sell-1')$$, 'selling is never blocked by the daily limit');
select throws_ok($$select pg_temp.buy('00000000-0000-0000-0000-0000000a0002', 'sell-rt', 'No', 1, 'dl-buy-3')$$, 'P0001', 'BP_DAILY_LIMIT', 'and a sale does not free buy room');

-- Shared per-minute limit.
reset role;
insert into positions (user_id, market_id, outcome_id, shares, avg_price)
values ('00000000-0000-0000-0000-0000000a0007', pg_temp.mid('sell-rt'), pg_temp.oid_of('sell-rt', 'No'), 100, 0.5);
update outcomes set shares_outstanding = shares_outstanding + 100 where id = pg_temp.oid_of('sell-rt', 'No');
insert into orders (user_id, market_id, outcome_id, amount, shares, avg_price, idempotency_key)
select '00000000-0000-0000-0000-0000000a0007', pg_temp.mid('sell-rt'), pg_temp.oid_of('sell-rt', 'No'), 1, 2, 0.5, 'rl-fill-' || g
  from generate_series(1, 10) g;
set local role authenticated;
select throws_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0007', 'sell-rt', 'No', 10, 'rl-sell-1')$$, 'P0001', 'BP_RATE_LIMITED', 'buys and sells share the per-minute limit');

-- ------------------------------------------------ resolution after a sale
create temp table res as select
  (pg_temp.buy('00000000-0000-0000-0000-0000000a0001', 'sell-res', 'Yes', 1000, 'res-buy-a') ->> 'shares')::numeric as a_shares,
  (pg_temp.buy('00000000-0000-0000-0000-0000000a0004', 'sell-res', 'No', 500, 'res-buy-d') ->> 'shares')::numeric as d_shares;
reset role;
grant select on res to authenticated;
set local role authenticated;
create temp table res_sale as select pg_temp.sell('00000000-0000-0000-0000-0000000a0001', 'sell-res', 'Yes', trunc((select a_shares from res) / 2, 8), 'res-sell-a') as r;
reset role;
create temp table res_before as select pg_temp.bal('00000000-0000-0000-0000-0000000a0001') as a;
update markets set status = 'resolving' where slug = 'sell-res';
insert into resolution_proposals (id, market_id, kind, outcome_id, evidence_url, note, status, approved_at, dispute_ends_at)
values ('81000000-0000-0000-0000-000000000004', pg_temp.mid('sell-res'), 'outcome', pg_temp.oid_of('sell-res', 'Yes'),
        'https://example.org/r', 'Yes won', 'approved', now(), now() - interval '1 minute');
select lives_ok($$select _settle('81000000-0000-0000-0000-000000000004', null)$$, 'a market with partial sales resolves');
select is(pg_temp.bal('00000000-0000-0000-0000-0000000a0001') - (select a from res_before),
  trunc((pg_temp.pos('00000000-0000-0000-0000-0000000a0001', 'sell-res', 'Yes')).shares, 2), 'the payout uses the remaining shares only');
select ok((select bool_and(resolved) from positions where market_id = pg_temp.mid('sell-res')), 'positions are marked resolved');
select is((pg_temp.pos('00000000-0000-0000-0000-0000000a0001', 'sell-res', 'Yes')).realized_pnl,
  ((select (r ->> 'proceeds')::numeric from res_sale) + trunc((pg_temp.pos('00000000-0000-0000-0000-0000000a0001', 'sell-res', 'Yes')).shares, 2) - 1000)::numeric(18,2),
  'winner realized = sales + payout - cost');
select is((pg_temp.pos('00000000-0000-0000-0000-0000000a0004', 'sell-res', 'No')).realized_pnl, -500.00, 'loser realized = - cost');

-- ------------------------------------------------------ void after sales
-- A buys Yes 1000 and sells it all, buys No 200 -> net cost refunded.
-- C buys Yes 100, D pushes Yes up, C sells at a gain -> net < 0, no refund.
create temp table vd as select
  (pg_temp.buy('00000000-0000-0000-0000-0000000a0001', 'sell-void', 'Yes', 1000, 'vd-buy-a1') ->> 'shares')::numeric as a_yes,
  (pg_temp.buy('00000000-0000-0000-0000-0000000a0003', 'sell-void', 'Yes', 100, 'vd-buy-c') ->> 'shares')::numeric as c_yes;
reset role;
grant select on vd to authenticated;
set local role authenticated;
select lives_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0001', 'sell-void', 'Yes', (select a_yes from vd), 'vd-sell-a')$$, 'A sells all Yes');
select lives_ok($$select pg_temp.buy('00000000-0000-0000-0000-0000000a0001', 'sell-void', 'No', 200, 'vd-buy-a2')$$, 'A buys No');
select lives_ok($$select pg_temp.buy('00000000-0000-0000-0000-0000000a0004', 'sell-void', 'Yes', 5000, 'vd-buy-d')$$, 'D pushes Yes up');
select lives_ok($$select pg_temp.sell('00000000-0000-0000-0000-0000000a0003', 'sell-void', 'Yes', (select c_yes from vd), 'vd-sell-c')$$, 'C sells at a gain');
reset role;
create temp table vd_flow as select user_id, sum(case when side = 'buy' then -amount else amount end) as flow
  from orders where market_id = pg_temp.mid('sell-void') group by user_id;
update markets set status = 'resolving' where slug = 'sell-void';
insert into resolution_proposals (id, market_id, kind, evidence_url, note, status, approved_at, dispute_ends_at)
values ('81000000-0000-0000-0000-000000000005', pg_temp.mid('sell-void'), 'void', 'https://example.org/v', 'Abandoned', 'approved', now(), now() - interval '1 minute');
select lives_ok($$select _settle('81000000-0000-0000-0000-000000000005', null)$$, 'a market with sales voids');
select is((select amount from ledger_entries where type = 'refund' and ref_id = pg_temp.mid('sell-void') and user_id = '00000000-0000-0000-0000-0000000a0001'),
  -(select flow from vd_flow where user_id = '00000000-0000-0000-0000-0000000a0001'), 'void refunds the net cost (buys - sells)');
select is((select count(*)::int from ledger_entries where type = 'refund' and ref_id = pg_temp.mid('sell-void') and user_id = '00000000-0000-0000-0000-0000000a0003'), 0,
  'no refund when sales exceeded cost (no claw-back either)');
select is((select sum(realized_pnl) from positions where market_id = pg_temp.mid('sell-void') and user_id = '00000000-0000-0000-0000-0000000a0001'), 0.00,
  'after a void A is exactly even');

-- ---------------------------------------------------------------- backfill
-- Simulates data settled before this migration: resolved market, positions not marked.
insert into positions (user_id, market_id, outcome_id, shares, avg_price) values
  ('00000000-0000-0000-0000-0000000a0003', pg_temp.mid('sell-old'), pg_temp.oid_of('sell-old', 'Yes'), 30, 0.5);
insert into orders (user_id, market_id, outcome_id, amount, shares, avg_price, idempotency_key) values
  ('00000000-0000-0000-0000-0000000a0003', pg_temp.mid('sell-old'), pg_temp.oid_of('sell-old', 'Yes'), 15, 30, 0.5, 'old-buy-key');
update markets set status = 'resolved', resolved_outcome_id = pg_temp.oid_of('sell-old', 'Yes'), resolved_at = now() where slug = 'sell-old';
insert into ledger_entries (user_id, amount, type, ref_id) values ('00000000-0000-0000-0000-0000000a0003', 30, 'payout', pg_temp.mid('sell-old'));
select is(_finalize_positions(pg_temp.mid('sell-old')), 1, 'the backfill marks old positions');
select is((pg_temp.pos('00000000-0000-0000-0000-0000000a0003', 'sell-old', 'Yes')).realized_pnl, 15.00, 'with payout - cost');
select is(_finalize_positions(pg_temp.mid('sell-old')), 0, 'and is idempotent');

-- -------------------------------------------------------------- invariants
select ok((select bool_and(balance >= 0) from wallets), 'no balance is ever negative');
select ok((select bool_and(w.balance = coalesce(l.s, 0)) from wallets w
             left join (select user_id, sum(amount) s from ledger_entries group by user_id) l on l.user_id = w.user_id),
  'every wallet equals the sum of its ledger');
select ok((select bool_and(abs(t - 1) < 1e-8) from (select sum(price) t from outcomes o join markets m on m.id = o.market_id
             where m.slug like 'sell-%' group by o.market_id) x), 'prices sum to 1 in every market');
-- LMSR bound: worst-case payout minus net collected <= b ln(n).
select ok((select bool_and(worst - collected <= 20000 * ln(2) + 0.01) from (
             select m.id,
                    (select max(o.shares_outstanding) from outcomes o where o.market_id = m.id) as worst,
                    (select coalesce(sum(case when side = 'buy' then amount else -amount end), 0) from orders r where r.market_id = m.id) as collected
               from markets m where m.slug in ('sell-rt', 'sell-res', 'sell-void')) x),
  'market-maker loss stays within b ln(n)');

select * from finish();
rollback;
