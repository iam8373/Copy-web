-- =============================================================================
-- 20261008000300_trading.sql — backend Phase B4: LMSR trading engine.
--
-- place_order() is the ONLY way to trade: one transaction that checks the
-- caller (auth.uid(), active, 18+ confirmed), the kill switch, the market
-- (open, before end_date, row locked), the amount (min/max from settings),
-- per-user limits (10 orders/minute, optional daily limit), and the wallet;
-- then prices the order with the LMSR market maker, updates outcomes, writes
-- the order, the position (cost-weighted average), the negative ledger entry,
-- price_history and volume. The same idempotency key returns the original
-- result and never spends twice.
--
-- Rounding rules (fixed): amounts are whole paise (2 dp); shares are
-- truncated (rounded DOWN) to 8 dp, so a buyer never receives more shares
-- than they paid for; prices are rounded to 10 dp.
--
-- Rollback:
--   drop function if exists public.place_order(uuid, uuid, numeric, text),
--     public.lmsr_lse(numeric[], numeric), public.lmsr_prices(numeric[], numeric),
--     public.lmsr_shares_for_amount(numeric[], numeric, integer, numeric);
--   alter table public.profiles drop column if exists daily_trade_limit;
-- (Orders, positions and ledger rows already written stay; they are append-only.)
-- =============================================================================

-- Responsible play: an optional per-user daily spend cap (credits, IST day).
alter table public.profiles
  add column if not exists daily_trade_limit numeric(18, 2)
    check (daily_trade_limit is null or daily_trade_limit > 0);

-- Numerically stable log-sum-exp of q/b: m + ln(sum(exp(q_i/b - m))).
create or replace function public.lmsr_lse(q numeric[], b numeric)
returns numeric
language sql
immutable
strict
set search_path = ''
as $$
  with x as (select v / b as v from unnest(q) as v),
       m as (select max(v) as m from x)
  select m.m + ln(sum(exp(x.v - m.m))) from x, m group by m.m;
$$;

-- Prices p_i = exp(q_i/b - lse), in input order. They sum to 1.
create or replace function public.lmsr_prices(q numeric[], b numeric)
returns numeric[]
language sql
immutable
strict
set search_path = ''
as $$
  select array_agg(exp(v / b - public.lmsr_lse(q, b)) order by ord)
    from unnest(q) with ordinality as t(v, ord);
$$;

-- Shares of outcome i (1-based) that `amount` buys, in log space so large
-- orders never overflow (mirrors sharesForAmount in src/lib/lmsr.ts):
--   shares = b * (A + lnS - lnEi + ln(1 + (e_i/S - 1) * exp(-A))),  A = amount/b
create or replace function public.lmsr_shares_for_amount(q numeric[], b numeric, i integer, amount numeric)
returns numeric
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  a     numeric := amount / b;
  ln_s  numeric := public.lmsr_lse(q, b);
  ln_ei numeric := q[i] / b;
  ratio numeric;
begin
  if amount <= 0 then return 0; end if;
  ratio := exp(ln_ei - ln_s);
  return b * (a + ln_s - ln_ei + ln(1 + (ratio - 1) * exp(-a)));
end;
$$;

revoke all on function public.lmsr_lse(numeric[], numeric) from public;
revoke all on function public.lmsr_prices(numeric[], numeric) from public;
revoke all on function public.lmsr_shares_for_amount(numeric[], numeric, integer, numeric) from public;
grant execute on function public.lmsr_lse(numeric[], numeric) to authenticated, service_role;
grant execute on function public.lmsr_prices(numeric[], numeric) to authenticated, service_role;
grant execute on function public.lmsr_shares_for_amount(numeric[], numeric, integer, numeric) to authenticated, service_role;

-- Errors are raised as 'BP_<CODE>' messages (errcode P0001) so the server can
-- map them to translated messages without parsing free text.
create or replace function public.place_order(
  p_market_id uuid, p_outcome_id uuid, p_amount numeric, p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid        uuid := auth.uid();
  prof       public.profiles%rowtype;
  mkt        public.markets%rowtype;
  existing   public.orders%rowtype;
  min_trade  numeric;
  max_trade  numeric;
  enabled    boolean;
  q          numeric[];
  ids        uuid[];
  idx        integer;
  shares     numeric;
  avg_price  numeric;
  new_prices numeric[];
  order_id   uuid;
  bal        numeric;
  spent      numeric;
  recent     integer;
  result     jsonb;
  j          integer;
begin
  if uid is null then
    raise exception 'BP_NOT_SIGNED_IN' using errcode = 'P0001';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 100 then
    raise exception 'BP_BAD_REQUEST' using errcode = 'P0001';
  end if;

  -- Serialise this user's orders (rate limit, daily limit, idempotency).
  select * into prof from public.profiles where id = uid for update;
  if not found then raise exception 'BP_NOT_SIGNED_IN' using errcode = 'P0001'; end if;

  -- Idempotent replay: same key returns the stored fill, nothing is spent.
  select * into existing from public.orders where user_id = uid and idempotency_key = p_idempotency_key;
  if found then
    if existing.market_id <> p_market_id or existing.outcome_id <> p_outcome_id or existing.amount <> p_amount then
      raise exception 'BP_IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    select balance into bal from public.wallets where user_id = uid;
    return jsonb_build_object(
      'order_id', existing.id, 'market_id', existing.market_id, 'outcome_id', existing.outcome_id,
      'amount', existing.amount, 'shares', existing.shares, 'avg_price', existing.avg_price,
      'prices', (select jsonb_object_agg(o.id, o.price) from public.outcomes o where o.market_id = existing.market_id),
      'balance', bal, 'replayed', true);
  end if;

  if prof.status <> 'active' then raise exception 'BP_ACCOUNT_SUSPENDED' using errcode = 'P0001'; end if;
  if prof.age_confirmed_at is null then raise exception 'BP_AGE_NOT_CONFIRMED' using errcode = 'P0001'; end if;

  select coalesce((value #>> '{}')::boolean, false) into enabled from public.app_settings where key = 'trading_enabled';
  if not coalesce(enabled, false) then raise exception 'BP_TRADING_DISABLED' using errcode = 'P0001'; end if;

  select coalesce((value #>> '{}')::numeric, 1) into min_trade from public.app_settings where key = 'min_trade';
  select coalesce((value #>> '{}')::numeric, 100000) into max_trade from public.app_settings where key = 'max_trade';
  min_trade := coalesce(min_trade, 1);
  max_trade := coalesce(max_trade, 100000);
  if p_amount is null or p_amount <> round(p_amount, 2) or p_amount < min_trade or p_amount > max_trade then
    raise exception 'BP_INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  -- Lock the market: concurrent orders on it are priced one after another.
  select * into mkt from public.markets where id = p_market_id for update;
  if not found or mkt.status <> 'open' or mkt.end_date <= now() then
    raise exception 'BP_MARKET_CLOSED' using errcode = 'P0001';
  end if;

  select array_agg(o.shares_outstanding order by o.sort_order), array_agg(o.id order by o.sort_order)
    into q, ids
    from public.outcomes o where o.market_id = p_market_id;
  idx := array_position(ids, p_outcome_id);
  if idx is null then raise exception 'BP_BAD_REQUEST' using errcode = 'P0001'; end if;

  select count(*) into recent from public.orders where user_id = uid and created_at > now() - interval '1 minute';
  if recent >= 10 then raise exception 'BP_RATE_LIMITED' using errcode = 'P0001'; end if;

  if prof.daily_trade_limit is not null then
    select coalesce(sum(amount), 0) into spent from public.orders
     where user_id = uid
       and (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;
    if spent + p_amount > prof.daily_trade_limit then
      raise exception 'BP_DAILY_LIMIT' using errcode = 'P0001';
    end if;
  end if;

  select balance into bal from public.wallets where user_id = uid for update;
  if bal is null or bal < p_amount then raise exception 'BP_INSUFFICIENT_FUNDS' using errcode = 'P0001'; end if;

  -- Price the order.
  shares := trunc(public.lmsr_shares_for_amount(q, mkt.liquidity_b, idx, p_amount), 8);
  if shares <= 0 then raise exception 'BP_INVALID_AMOUNT' using errcode = 'P0001'; end if;
  avg_price := round(p_amount / shares, 10);
  q[idx] := q[idx] + shares;
  new_prices := public.lmsr_prices(q, mkt.liquidity_b);

  for j in 1 .. array_length(ids, 1) loop
    update public.outcomes
       set shares_outstanding = q[j], price = round(new_prices[j], 10)
     where id = ids[j];
  end loop;

  insert into public.orders (user_id, market_id, outcome_id, amount, shares, avg_price, idempotency_key)
  values (uid, p_market_id, p_outcome_id, p_amount, shares, avg_price, p_idempotency_key)
  returning id into order_id;

  -- Cost-weighted average entry price.
  insert into public.positions as p (user_id, market_id, outcome_id, shares, avg_price)
  values (uid, p_market_id, p_outcome_id, shares, avg_price)
  on conflict (user_id, outcome_id) do update
     set shares = p.shares + excluded.shares,
         avg_price = round((p.avg_price * p.shares + p_amount) / (p.shares + excluded.shares), 10);

  insert into public.ledger_entries (user_id, amount, type, ref_id, note)
  values (uid, -p_amount, 'trade', order_id, 'Order');

  insert into public.price_history (market_id, outcome_id, price, volume)
  select p_market_id, ids[g.n], round(new_prices[g.n], 10), case when g.n = idx then p_amount else 0 end
    from generate_series(1, array_length(ids, 1)) as g(n);

  update public.markets set total_volume = total_volume + p_amount where id = p_market_id;

  select balance into bal from public.wallets where user_id = uid;
  result := jsonb_build_object(
    'order_id', order_id, 'market_id', p_market_id, 'outcome_id', p_outcome_id,
    'amount', p_amount, 'shares', shares, 'avg_price', avg_price,
    'prices', (select jsonb_object_agg(ids[g.n], round(new_prices[g.n], 10)) from generate_series(1, array_length(ids, 1)) as g(n)),
    'balance', bal, 'replayed', false);
  return result;
end;
$$;

revoke all on function public.place_order(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.place_order(uuid, uuid, numeric, text) to authenticated;
