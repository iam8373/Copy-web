-- pgTAP: LMSR trading engine and wallet (backend Phase B4).
-- Run with `supabase test db`. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(46);

-- ---------------------------------------------------------------- fixtures
-- Users A (trader), B (daily limit), S (suspended), N (no age consent).
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@trade.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@trade.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 's@trade.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d1', 'n@trade.test', 'authenticated', 'authenticated');
update profiles set age_confirmed_at = now() where id in
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
update profiles set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000c1';
update profiles set daily_trade_limit = 50 where id = '00000000-0000-0000-0000-0000000000b1';

-- Fresh 50/50 binary markets (b = 20,000) for the price-impact table, a
-- 3-outcome market, a closed one and an expired one.
insert into markets (id, slug, title, category, subcategory, end_date, status, is_binary, liquidity_b) values
  ('30000000-0000-0000-0000-000000000100', 'impact-100', 'Impact 100', 'cricket', 'IPL', now() + interval '7 days', 'open', true, 20000),
  ('30000000-0000-0000-0000-000000001000', 'impact-1000', 'Impact 1000', 'cricket', 'IPL', now() + interval '7 days', 'open', true, 20000),
  ('30000000-0000-0000-0000-000000010000', 'impact-10000', 'Impact 10000', 'cricket', 'IPL', now() + interval '7 days', 'open', true, 20000),
  ('30000000-0000-0000-0000-00000000000f', 'multi', 'Multi', 'cricket', 'IPL', now() + interval '7 days', 'open', false, 20000),
  ('30000000-0000-0000-0000-00000000000c', 'closed', 'Closed', 'cricket', 'IPL', now() + interval '7 days', 'closed', true, 20000),
  ('30000000-0000-0000-0000-00000000000e', 'expired', 'Expired', 'cricket', 'IPL', now() - interval '1 hour', 'open', true, 20000),
  ('30000000-0000-0000-0000-0000000000ff', 'busy', 'Busy', 'cricket', 'IPL', now() + interval '7 days', 'open', true, 20000);
insert into outcomes (id, market_id, label, sort_order, price, shares_outstanding)
select gen_random_uuid(), m.id, l.label, l.ord - 1, 0.5, 0
  from markets m, unnest(array['Yes', 'No']) with ordinality as l(label, ord)
 where m.slug in ('impact-100', 'impact-1000', 'impact-10000', 'closed', 'expired', 'busy');
insert into outcomes (id, market_id, label, sort_order, price, shares_outstanding)
select gen_random_uuid(), '30000000-0000-0000-0000-00000000000f', l.label, l.ord - 1, 1.0 / 3, 0
  from unnest(array['A', 'B', 'C']) with ordinality as l(label, ord);

create function pg_temp.oid_of(slug text, label text) returns uuid language sql as $$
  select o.id from public.outcomes o join public.markets m on m.id = o.market_id
   where m.slug = $1 and o.label = $2 $$;
create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true) $$;

-- ------------------------------------------------------------- privileges
select ok(not has_function_privilege('anon', 'public.place_order(uuid,uuid,numeric,text)', 'execute'),
  'anon cannot call place_order');
select ok(has_function_privilege('authenticated', 'public.place_order(uuid,uuid,numeric,text)', 'execute'),
  'signed-in users can call place_order');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(format($$select place_order('30000000-0000-0000-0000-000000000100', %L, 100, 'no-user-key')$$,
  pg_temp.oid_of('impact-100', 'Yes')), 'P0001', 'BP_NOT_SIGNED_IN', 'an order needs a signed-in user');

-- ---------------------------------------------------- price-impact table
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select is((place_order('30000000-0000-0000-0000-000000000100', pg_temp.oid_of('impact-100', 'Yes'), 100, 'impact-100-key') ->> 'shares')::numeric,
  199.50248653, '₹100 on a fresh 50/50 market buys 199.50248653 shares (b = 20,000)');
select is((place_order('30000000-0000-0000-0000-000000001000', pg_temp.oid_of('impact-1000', 'Yes'), 1000, 'impact-1000-key') ->> 'shares')::numeric,
  1952.37195352, '₹1,000 buys 1952.37195352 shares');
select is((place_order('30000000-0000-0000-0000-000000010000', pg_temp.oid_of('impact-10000', 'Yes'), 10000 - 1100, 'impact-x-key') ->> 'replayed'),
  'false', 'a third order within the balance goes through');
reset role;
-- ₹10,000 needs a fresh balance: top up A through the ledger (as the owner role).
insert into ledger_entries (user_id, amount, type, note) values ('00000000-0000-0000-0000-0000000000a1', 20000, 'admin_adjustment', 'test top-up');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
reset role;
-- Reset the 10,000 market to fresh before measuring.
update outcomes set shares_outstanding = 0, price = 0.5 where market_id = '30000000-0000-0000-0000-000000010000';
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select is((place_order('30000000-0000-0000-0000-000000010000', pg_temp.oid_of('impact-10000', 'Yes'), 10000, 'impact-10000-key') ->> 'shares')::numeric,
  16635.93131502, '₹10,000 buys 16635.93131502 shares');
reset role;

select is((select price from outcomes where id = pg_temp.oid_of('impact-100', 'Yes')), 0.5024937604::numeric(12,10),
  '₹100 moves Yes from 50.00% to 50.25%');
select is((select price from outcomes where id = pg_temp.oid_of('impact-1000', 'Yes')), 0.5243852877::numeric(12,10),
  '₹1,000 moves Yes to 52.44%');
select is((select price from outcomes where id = pg_temp.oid_of('impact-10000', 'Yes')), 0.6967346701::numeric(12,10),
  '₹10,000 moves Yes to 69.67%');
select is((select avg_price from orders where idempotency_key = 'impact-1000-key'), 0.5121974828::numeric(12,10),
  'average price of the ₹1,000 order is 0.5121974828');
select ok((select bool_and(abs(t.s - 1) < 0.000000001)
             from (select sum(price) s from outcomes group by market_id) t),
  'prices of every market sum to 1 (within 1e-9)');

-- ---------------------------------------------------- multi-outcome market
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select lives_ok(format($$select place_order('30000000-0000-0000-0000-00000000000f', %L, 500, 'multi-key-1')$$, pg_temp.oid_of('multi', 'B')),
  'a multi-outcome order goes through');
reset role;
select ok((select abs(sum(price) - 1) < 0.000000001 from outcomes where market_id = '30000000-0000-0000-0000-00000000000f'),
  'multi-outcome prices still sum to 1');
select ok((select price from outcomes where id = pg_temp.oid_of('multi', 'B')) >
          (select price from outcomes where id = pg_temp.oid_of('multi', 'A')),
  'the bought outcome went up relative to the others');
select is((select count(*)::int from price_history where market_id = '30000000-0000-0000-0000-00000000000f'), 3,
  'one price_history row per outcome');
select is((select total_volume from markets where id = '30000000-0000-0000-0000-00000000000f'), 500.00::numeric,
  'market volume grew by the order amount');

-- ------------------------------------------------------ wallet and ledger
select is((select balance from wallets where user_id = '00000000-0000-0000-0000-0000000000a1'),
  (10000 + 20000 - 100 - 1000 - 8900 - 10000 - 500)::numeric, 'balance fell by exactly the amounts spent');
select is((select count(*)::int from ledger_entries where user_id = '00000000-0000-0000-0000-0000000000a1' and type = 'trade'), 5,
  'one negative trade ledger entry per order');
select ok((select bool_and(w.balance = coalesce(l.total, 0))
             from wallets w left join (select user_id, sum(amount) total from ledger_entries group by user_id) l using (user_id)),
  'every wallet balance equals the sum of its ledger');

-- ------------------------------------------------------------ idempotency
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select is((place_order('30000000-0000-0000-0000-00000000000f', pg_temp.oid_of('multi', 'B'), 500, 'multi-key-1') ->> 'replayed'),
  'true', 'retrying with the same key returns the original fill');
reset role;
select is((select count(*)::int from orders where idempotency_key = 'multi-key-1'), 1, '…without a second order');
select is((select total_volume from markets where id = '30000000-0000-0000-0000-00000000000f'), 500.00::numeric,
  '…or a second charge');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$select place_order('30000000-0000-0000-0000-00000000000f', %L, 600, 'multi-key-1')$$, pg_temp.oid_of('multi', 'B')),
  'P0001', 'BP_IDEMPOTENCY_CONFLICT', 'the same key with a different amount is refused');

-- ------------------------------------------------- position (weighted avg)
select lives_ok(format($$select place_order('30000000-0000-0000-0000-00000000000f', %L, 500, 'multi-key-2')$$, pg_temp.oid_of('multi', 'B')),
  'a second order on the same outcome');
reset role;
select is((select count(*)::int from positions where user_id = '00000000-0000-0000-0000-0000000000a1' and outcome_id = pg_temp.oid_of('multi', 'B')), 1,
  'both orders merge into one position');
select ok((select abs(p.avg_price - 1000 / p.shares) < 0.0000001 and p.shares = (select sum(o.shares) from orders o where o.outcome_id = p.outcome_id and o.user_id = p.user_id)
             from positions p where p.user_id = '00000000-0000-0000-0000-0000000000a1' and p.outcome_id = pg_temp.oid_of('multi', 'B')),
  'position avg price = total cost / total shares, shares = sum of fills');

-- -------------------------------------------------------------- refusals
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$select place_order('30000000-0000-0000-0000-00000000000c', %L, 10, 'closed-key-1')$$, pg_temp.oid_of('closed', 'Yes')),
  'P0001', 'BP_MARKET_CLOSED', 'a closed market refuses orders');
select throws_ok(format($$select place_order('30000000-0000-0000-0000-00000000000e', %L, 10, 'expired-key-1')$$, pg_temp.oid_of('expired', 'Yes')),
  'P0001', 'BP_MARKET_CLOSED', 'an open market past its end date refuses orders');
select throws_ok(format($$select place_order('30000000-0000-0000-0000-00000000000f', %L, 10, 'wrong-mkt-key')$$, pg_temp.oid_of('closed', 'Yes')),
  'P0001', 'BP_BAD_REQUEST', 'an outcome from another market is refused');
select throws_ok(format($$select place_order('30000000-0000-0000-0000-00000000000f', %L, 0.5, 'small-key-1')$$, pg_temp.oid_of('multi', 'A')),
  'P0001', 'BP_INVALID_AMOUNT', 'below the minimum is refused');
select throws_ok(format($$select place_order('30000000-0000-0000-0000-00000000000f', %L, 1.234, 'paise-key-1')$$, pg_temp.oid_of('multi', 'A')),
  'P0001', 'BP_INVALID_AMOUNT', 'fractions of a paisa are refused');
select throws_ok(format($$select place_order('30000000-0000-0000-0000-00000000000f', %L, 100001, 'big-key-1')$$, pg_temp.oid_of('multi', 'A')),
  'P0001', 'BP_INVALID_AMOUNT', 'above max_trade is refused');
select throws_ok(format($$select place_order('30000000-0000-0000-0000-00000000000f', %L, 99999, 'broke-key-1')$$, pg_temp.oid_of('multi', 'A')),
  'P0001', 'BP_INSUFFICIENT_FUNDS', 'an order larger than the balance is refused');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select throws_ok(format($$select place_order('30000000-0000-0000-0000-00000000000f', %L, 10, 'susp-key-1')$$, pg_temp.oid_of('multi', 'A')),
  'P0001', 'BP_ACCOUNT_SUSPENDED', 'a suspended account cannot trade');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select throws_ok(format($$select place_order('30000000-0000-0000-0000-00000000000f', %L, 10, 'noage-key-1')$$, pg_temp.oid_of('multi', 'A')),
  'P0001', 'BP_AGE_NOT_CONFIRMED', 'an account without the 18+ confirmation cannot trade');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select lives_ok(format($$select place_order('30000000-0000-0000-0000-00000000000f', %L, 40, 'daily-key-1')$$, pg_temp.oid_of('multi', 'A')),
  'within the daily limit (40 of 50)');
select throws_ok(format($$select place_order('30000000-0000-0000-0000-00000000000f', %L, 20, 'daily-key-2')$$, pg_temp.oid_of('multi', 'A')),
  'P0001', 'BP_DAILY_LIMIT', 'over the daily limit (40 + 20 > 50) is refused');
reset role;

-- Kill switch.
update app_settings set value = 'false'::jsonb where key = 'trading_enabled';
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$select place_order('30000000-0000-0000-0000-00000000000f', %L, 10, 'kill-key-1')$$, pg_temp.oid_of('multi', 'A')),
  'P0001', 'BP_TRADING_DISABLED', 'the kill switch stops all orders');
reset role;
update app_settings set value = 'true'::jsonb where key = 'trading_enabled';

-- Rate limit: 10 orders per minute per user (A has placed 6 so far).
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$select place_order('30000000-0000-0000-0000-0000000000ff', pg_temp.oid_of('busy', 'Yes'), 1, 'busy-key-' || g) from generate_series(1, 4) g$$,
  'up to 10 orders in a minute are accepted');
select throws_ok(format($$select place_order('30000000-0000-0000-0000-0000000000ff', %L, 1, 'busy-key-11')$$, pg_temp.oid_of('busy', 'Yes')),
  'P0001', 'BP_RATE_LIMITED', 'the 11th order within a minute is refused');

-- Direct writes stay impossible.
select throws_ok($$update outcomes set price = 0.99$$, '42501', null, 'prices cannot be written directly');
select throws_ok($$insert into orders (user_id, market_id, outcome_id, amount, shares, avg_price, idempotency_key)
  values ('00000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-00000000000f', pg_temp.oid_of('multi', 'A'), 1, 1, 1, 'direct-key-1')$$,
  '42501', null, 'orders cannot be inserted directly');
reset role;

-- ------------------------------------------------------------- invariants
select ok((select bool_and(balance >= 0) from wallets), 'no wallet is ever negative');
select ok((select bool_and(w.balance = coalesce(l.total, 0))
             from wallets w left join (select user_id, sum(amount) total from ledger_entries group by user_id) l using (user_id)),
  'ledger sums still equal wallet balances after every refusal');
select ok((select bool_and(abs(t.s - 1) < 0.000000001) from (select sum(price) s from outcomes group by market_id) t),
  'prices of every market still sum to 1');

select * from finish();
rollback;
