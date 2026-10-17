-- =============================================================================
-- 20261017000100_sell.sql — Phase S1: sell-back.
--
-- Users can sell shares they hold back to the market maker (LMSR). Proceeds
-- = C(q) - C(q - s e_i), rounded DOWN to the paisa (rounding never favours
-- the user). The ledger stays append-only: a sale is a positive 'sale' row.
--
-- Also fixes settlement (found in S1 review): _settle never marked positions
-- resolved nor set realized_pnl, so settled markets looked open. Positions
-- are now finalized from the order and ledger flows, and an idempotent
-- backfill corrects markets already resolved or voided.
--
-- Void now refunds each user's NET cost on the market (buys minus sell
-- proceeds); a user who sold for more than they paid gets no refund and is
-- not clawed back.
--
-- Rollback (sells already written stay; they are append-only):
--   drop function if exists public.sell_shares(uuid, uuid, numeric, text),
--     public.lmsr_proceeds_for_shares(numeric[], numeric, integer, numeric),
--     public._finalize_positions(uuid), public.market_net_cost(uuid);
--   then restore place_order, _settle, admin_resolution_preview and
--   admin_user_detail from 20261010000100_admin.sql, 20261012000100 and
--   20261014000100. Only if NO sell orders or sale rows exist:
--   alter table public.orders drop column realized_pnl, drop constraint orders_side_check,
--     add constraint orders_side_check check (side = 'buy') ...;
--   and the old ledger type list. With sells present, keep the schema.
-- =============================================================================

-- ------------------------------------------------------------------ schema
alter table public.orders drop constraint if exists orders_side_check;
alter table public.orders add constraint orders_side_check check (side in ('buy', 'sell'));

-- For a sell, `amount` is the proceeds credited (0.00 only when a whole dust
-- position is closed) and avg_price = proceeds / shares.
alter table public.orders drop constraint if exists orders_amount_check;
alter table public.orders add constraint orders_amount_check
  check ((side = 'buy' and amount > 0) or (side = 'sell' and amount >= 0));
alter table public.orders drop constraint if exists orders_avg_price_check;
alter table public.orders add constraint orders_avg_price_check
  check (avg_price <= 1 and ((side = 'buy' and avg_price > 0) or (side = 'sell' and avg_price >= 0)));

-- Realized profit of a sell: proceeds - avg_price x shares sold (null for buys).
alter table public.orders add column if not exists realized_pnl numeric(18, 2);
alter table public.orders add constraint orders_realized_only_sells
  check ((side = 'buy') = (realized_pnl is null));

alter table public.ledger_entries drop constraint if exists ledger_entries_type_check;
alter table public.ledger_entries add constraint ledger_entries_type_check
  check (type in ('signup_credit', 'trade', 'sale', 'payout', 'refund', 'admin_adjustment'));

-- ------------------------------------------------------------------ LMSR
-- Credits received for selling s shares of outcome i (1-based):
--   b * (lse(q) - lse(q - s e_i)), with the same stable log-sum-exp as buying.
create or replace function public.lmsr_proceeds_for_shares(q numeric[], b numeric, i integer, s numeric)
returns numeric
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  q2 numeric[] := q;
begin
  if s <= 0 then return 0; end if;
  q2[i] := q2[i] - s;
  return b * (public.lmsr_lse(q, b) - public.lmsr_lse(q2, b));
end;
$$;
revoke all on function public.lmsr_proceeds_for_shares(numeric[], numeric, integer, numeric) from public;
grant execute on function public.lmsr_proceeds_for_shares(numeric[], numeric, integer, numeric) to authenticated, service_role;

-- --------------------------------------------------------------- helpers
-- Net cost per user on a market: buys minus sell proceeds. Internal.
create or replace function public.market_net_cost(p_market_id uuid)
returns table (user_id uuid, net numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select o.user_id, sum(case when o.side = 'buy' then o.amount else -o.amount end)
    from public.orders o where o.market_id = p_market_id
   group by o.user_id
$$;
revoke all on function public.market_net_cost(uuid) from public, anon, authenticated, service_role;

-- Marks every position of a resolved or voided market resolved, with its
-- lifetime realized P&L computed from what actually moved:
--   sell proceeds - buy cost + (payout or this position's share of the refund).
-- Deterministic and idempotent (sets, never increments). Internal.
create or replace function public._finalize_positions(p_market_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  mkt public.markets%rowtype;
  n   integer;
begin
  select * into mkt from public.markets where id = p_market_id;
  if not found or mkt.status not in ('resolved', 'voided') then
    raise exception 'BP_WRONG_STATUS' using errcode = 'P0001';
  end if;
  with flows as (
    select p.id, p.user_id, p.outcome_id,
           coalesce(sum(o.amount) filter (where o.side = 'buy'), 0) as b,
           coalesce(sum(o.amount) filter (where o.side = 'sell'), 0) as s
      from public.positions p
      left join public.orders o on o.user_id = p.user_id and o.outcome_id = p.outcome_id
     where p.market_id = p_market_id
     group by p.id, p.user_id, p.outcome_id),
  credited as (
    select l.user_id, l.type, sum(l.amount) as amt
      from public.ledger_entries l
     where l.ref_id = p_market_id and l.type in ('payout', 'refund')
     group by l.user_id, l.type),
  alloc as (
    -- Void: a user's refund is spread over their positions in outcome order,
    -- each taking at most its own net cost, so the parts add up exactly.
    select f.id,
           greatest(0, least(greatest(f.b - f.s, 0),
             coalesce(r.amt, 0) - coalesce(sum(greatest(f.b - f.s, 0)) over (
               partition by f.user_id order by f.outcome_id
               rows between unbounded preceding and 1 preceding), 0))) as refund_part
      from flows f
      left join credited r on r.user_id = f.user_id and r.type = 'refund'),
  fin as (
    select f.id,
           f.s - f.b
           + case when mkt.status = 'resolved' and f.outcome_id = mkt.resolved_outcome_id
                  then coalesce(pay.amt, 0) else 0 end
           + case when mkt.status = 'voided' then a.refund_part else 0 end as pnl
      from flows f
      join alloc a on a.id = f.id
      left join credited pay on pay.user_id = f.user_id and pay.type = 'payout')
  update public.positions p
     set resolved = true, realized_pnl = fin.pnl
    from fin
   where p.id = fin.id
     and (p.resolved is distinct from true or p.realized_pnl is distinct from fin.pnl);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public._finalize_positions(uuid) from public, anon, authenticated, service_role;

-- ------------------------------------------------------------- sell_shares
create or replace function public.sell_shares(
  p_market_id uuid, p_outcome_id uuid, p_shares numeric, p_idempotency_key text
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
  pos        public.positions%rowtype;
  existing   public.orders%rowtype;
  enabled    boolean;
  q          numeric[];
  ids        uuid[];
  idx        integer;
  proceeds   numeric;
  cost_sold  numeric;
  realized   numeric;
  whole      boolean;
  new_prices numeric[];
  order_id   uuid;
  bal        numeric;
  recent     integer;
  j          integer;
begin
  if uid is null then raise exception 'BP_NOT_SIGNED_IN' using errcode = 'P0001'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 100 then
    raise exception 'BP_BAD_REQUEST' using errcode = 'P0001';
  end if;

  -- Serialise this user's orders (rate limit, idempotency), as place_order.
  select * into prof from public.profiles where id = uid for update;
  if not found then raise exception 'BP_NOT_SIGNED_IN' using errcode = 'P0001'; end if;

  -- Idempotent replay: same key returns the stored sale, nothing is credited twice.
  select * into existing from public.orders where user_id = uid and idempotency_key = p_idempotency_key;
  if found then
    if existing.side <> 'sell' or existing.market_id <> p_market_id or existing.outcome_id <> p_outcome_id
       or existing.shares <> p_shares then
      raise exception 'BP_IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    select balance into bal from public.wallets where user_id = uid;
    return jsonb_build_object(
      'order_id', existing.id, 'market_id', existing.market_id, 'outcome_id', existing.outcome_id, 'side', 'sell',
      'shares', existing.shares, 'proceeds', existing.amount, 'avg_price', existing.avg_price,
      'realized_pnl', existing.realized_pnl,
      'prices', (select jsonb_object_agg(o.id, o.price) from public.outcomes o where o.market_id = existing.market_id),
      'position_shares', (select shares from public.positions where user_id = uid and outcome_id = existing.outcome_id),
      'balance', bal, 'replayed', true);
  end if;

  -- Same gates as buying. Suspended accounts cannot sell either (they cannot
  -- trade at all; positions are still paid out on resolution).
  if prof.status <> 'active' then raise exception 'BP_ACCOUNT_SUSPENDED' using errcode = 'P0001'; end if;
  if prof.age_confirmed_at is null then raise exception 'BP_AGE_NOT_CONFIRMED' using errcode = 'P0001'; end if;
  if prof.role <> 'user' and not coalesce((public._setting('staff_can_trade') #>> '{}')::boolean, false) then
    raise exception 'BP_STAFF_CANNOT_TRADE' using errcode = 'P0001';
  end if;
  select coalesce((value #>> '{}')::boolean, false) into enabled from public.app_settings where key = 'trading_enabled';
  if not coalesce(enabled, false) then raise exception 'BP_TRADING_DISABLED' using errcode = 'P0001'; end if;

  if p_shares is null or p_shares <= 0 or p_shares <> trunc(p_shares, 8) then
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

  -- One per-minute limit for buys and sells together.
  select count(*) into recent from public.orders where user_id = uid and created_at > now() - interval '1 minute';
  if recent >= 10 then raise exception 'BP_RATE_LIMITED' using errcode = 'P0001'; end if;

  -- Never oversell, never a negative position.
  select * into pos from public.positions where user_id = uid and outcome_id = p_outcome_id for update;
  if not found or pos.shares < p_shares then
    raise exception 'BP_INSUFFICIENT_SHARES' using errcode = 'P0001';
  end if;
  whole := pos.shares = p_shares;

  proceeds := trunc(public.lmsr_proceeds_for_shares(q, mkt.liquidity_b, idx, p_shares), 2);
  if proceeds < 0 then proceeds := 0; end if;
  -- At least 1 credit, unless the whole position is closed (dust may give 0.00).
  if proceeds < 1 and not whole then raise exception 'BP_SELL_TOO_SMALL' using errcode = 'P0001'; end if;

  q[idx] := q[idx] - p_shares;
  new_prices := public.lmsr_prices(q, mkt.liquidity_b);
  for j in 1 .. array_length(ids, 1) loop
    update public.outcomes set shares_outstanding = q[j], price = round(new_prices[j], 10) where id = ids[j];
  end loop;

  cost_sold := round(pos.avg_price * p_shares, 2);
  realized := proceeds - cost_sold;

  insert into public.orders (user_id, market_id, outcome_id, side, amount, shares, avg_price, realized_pnl, idempotency_key)
  values (uid, p_market_id, p_outcome_id, 'sell', proceeds, p_shares,
          least(round(proceeds / p_shares, 10), 1), realized, p_idempotency_key)
  returning id into order_id;

  -- Average entry price is unchanged on the remaining shares.
  update public.positions
     set shares = shares - p_shares, realized_pnl = realized_pnl + realized
   where id = pos.id;

  if proceeds > 0 then
    insert into public.ledger_entries (user_id, amount, type, ref_id, note)
    values (uid, proceeds, 'sale', order_id, 'Sale');
  end if;

  insert into public.price_history (market_id, outcome_id, price, volume)
  select p_market_id, ids[g.n], round(new_prices[g.n], 10), case when g.n = idx then proceeds else 0 end
    from generate_series(1, array_length(ids, 1)) as g(n);

  update public.markets set total_volume = total_volume + proceeds where id = p_market_id;

  select balance into bal from public.wallets where user_id = uid;
  return jsonb_build_object(
    'order_id', order_id, 'market_id', p_market_id, 'outcome_id', p_outcome_id, 'side', 'sell',
    'shares', p_shares, 'proceeds', proceeds, 'avg_price', least(round(proceeds / p_shares, 10), 1),
    'realized_pnl', realized,
    'prices', (select jsonb_object_agg(ids[g.n], round(new_prices[g.n], 10)) from generate_series(1, array_length(ids, 1)) as g(n)),
    'position_shares', pos.shares - p_shares,
    'balance', bal, 'replayed', false);
end;
$$;
revoke all on function public.sell_shares(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.sell_shares(uuid, uuid, numeric, text) to authenticated;

-- ------------------------------------------- redefinitions (see header)
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
    if existing.side <> 'buy' or existing.market_id <> p_market_id or existing.outcome_id <> p_outcome_id or existing.amount <> p_amount then
      raise exception 'BP_IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    select balance into bal from public.wallets where user_id = uid;
    return jsonb_build_object(
      'order_id', existing.id, 'market_id', existing.market_id, 'outcome_id', existing.outcome_id,
      'amount', existing.amount, 'shares', existing.shares, 'avg_price', existing.avg_price,
      'prices', (select jsonb_object_agg(o.id, o.price) from public.outcomes o where o.market_id = existing.market_id),
      'balance', bal, 'side', 'buy', 'replayed', true);
  end if;

  if prof.status <> 'active' then raise exception 'BP_ACCOUNT_SUSPENDED' using errcode = 'P0001'; end if;
  if prof.age_confirmed_at is null then raise exception 'BP_AGE_NOT_CONFIRMED' using errcode = 'P0001'; end if;
  -- Staff do not trade (they can see and move markets) unless the owner allows it.
  if prof.role <> 'user' and not coalesce((public._setting('staff_can_trade') #>> '{}')::boolean, false) then
    raise exception 'BP_STAFF_CANNOT_TRADE' using errcode = 'P0001';
  end if;

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
    -- Buys only: selling is never blocked by a self-set limit (S1).
    select coalesce(sum(amount), 0) into spent from public.orders
     where user_id = uid and side = 'buy'
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
    'balance', bal, 'side', 'buy', 'replayed', false);
  return result;
end;
$$;

revoke all on function public.place_order(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.place_order(uuid, uuid, numeric, text) to authenticated;

create or replace function public._settle(p_proposal_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  prop   public.resolution_proposals%rowtype;
  mkt    public.markets%rowtype;
  users  integer;
  total  numeric;
begin
  select * into prop from public.resolution_proposals where id = p_proposal_id for update;
  if not found then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  if prop.status <> 'approved' then raise exception 'BP_WRONG_STATUS' using errcode = 'P0001'; end if;
  if prop.dispute_ends_at > now() then raise exception 'BP_DISPUTE_WINDOW_OPEN' using errcode = 'P0001'; end if;
  select * into mkt from public.markets where id = prop.market_id for update;
  if mkt.status <> 'resolving' then raise exception 'BP_WRONG_STATUS' using errcode = 'P0001'; end if;

  if prop.kind = 'outcome' then
    -- Each winning share pays 1 credit (rounded down to the paisa).
    with paid as (
      insert into public.ledger_entries (user_id, amount, type, ref_id, note)
      select p.user_id, trunc(p.shares, 2), 'payout', mkt.id, 'Payout: ' || left(mkt.title, 400)
        from public.positions p
       where p.market_id = mkt.id and p.outcome_id = prop.outcome_id and trunc(p.shares, 2) > 0
      returning amount)
    select count(*), coalesce(sum(amount), 0) into users, total from paid;
    update public.markets set status = 'resolved', resolved_outcome_id = prop.outcome_id, resolved_at = now()
     where id = mkt.id;
  else
    -- Void: each user gets back their NET cost on this market (buys minus
    -- sell proceeds). A user who sold for more than they paid gets nothing
    -- back and keeps the difference (no claw-back; the ledger never goes
    -- negative).
    with refunded as (
      insert into public.ledger_entries (user_id, amount, type, ref_id, note)
      select n.user_id, n.net, 'refund', mkt.id, 'Refund (market voided): ' || left(mkt.title, 380)
        from public.market_net_cost(mkt.id) n
       where n.net > 0
      returning amount)
    select count(*), coalesce(sum(amount), 0) into users, total from refunded;
    update public.markets set status = 'voided', resolved_at = now() where id = mkt.id;
  end if;

  perform public._finalize_positions(mkt.id);
  update public.resolution_proposals set status = 'finalized', finalized_at = now() where id = p_proposal_id;
  perform public._audit(p_actor, 'resolution.finalize', 'resolution', p_proposal_id::text,
    jsonb_build_object('status', 'approved'),
    jsonb_build_object('status', 'finalized', 'kind', prop.kind, 'market_id', mkt.id,
                       'outcome_id', prop.outcome_id, 'users_credited', users, 'credits_total', total,
                       'self_approved', prop.self_approved, 'by', case when p_actor is null then 'scheduled job' else 'admin' end));
  return jsonb_build_object('users', users, 'total', total);
end;
$$;
revoke all on function public._settle(uuid, uuid) from public, anon, authenticated, service_role;

create or replace function public.admin_resolution_preview(p_market_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me  public.profiles%rowtype := public._staff('moderator');
  out jsonb;
begin
  if not exists (select 1 from public.markets where id = p_market_id) then
    raise exception 'BP_NOT_FOUND' using errcode = 'P0001';
  end if;
  select jsonb_build_object(
    'outcomes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'outcome_id', o.id,
               'holders', (select count(*) from public.positions p where p.outcome_id = o.id and trunc(p.shares, 2) > 0),
               'payout', (select coalesce(sum(trunc(p.shares, 2)), 0) from public.positions p where p.outcome_id = o.id))
             order by o.sort_order)
        from public.outcomes o where o.market_id = p_market_id), '[]'::jsonb),
    'refund_users', (select count(*) from public.market_net_cost(p_market_id) where net > 0),
    'refund_total', (select coalesce(sum(net), 0) from public.market_net_cost(p_market_id) where net > 0))
  into out;
  return out;
end;
$$;


create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me  public.profiles%rowtype := public._staff('admin');
  out jsonb;
begin
  select jsonb_build_object(
    'id', p.id, 'email', u.email, 'handle', p.handle, 'role', p.role, 'status', p.status,
    'suspended_reason', p.suspended_reason, 'suspended_at', p.suspended_at,
    'created_at', p.created_at, 'age_confirmed_at', p.age_confirmed_at, 'terms_version', p.terms_version,
    'last_sign_in_at', u.last_sign_in_at,
    'provider', u.raw_app_meta_data ->> 'provider',
    'mfa_factors', (select count(*) from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified'),
    'balance', (select balance from public.wallets where user_id = p.id),
    'orders', (select count(*) from public.orders where user_id = p.id),
    'recent_orders', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (
                       select o.id, o.side, o.amount, o.shares, o.avg_price, o.realized_pnl, o.created_at,
                              m.slug as market_slug, m.title as market_title, oc.label as outcome
                         from public.orders o
                         join public.markets m on m.id = o.market_id
                         join public.outcomes oc on oc.id = o.outcome_id
                        where o.user_id = p.id order by o.created_at desc limit 50) r), '[]'::jsonb),
    'ledger', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc)
                          from (select id, amount, type, note, created_at from public.ledger_entries
                                 where user_id = p.id order by created_at desc limit 50) l), '[]'::jsonb),
    'positions', coalesce((select jsonb_agg(jsonb_build_object(
                             'market_slug', m.slug, 'market_title', m.title, 'market_status', m.status,
                             'outcome', o.label, 'shares', x.shares, 'avg_price', x.avg_price) order by m.title)
                             from public.positions x
                             join public.markets m on m.id = x.market_id
                             join public.outcomes o on o.id = x.outcome_id
                            where x.user_id = p.id and x.shares > 0), '[]'::jsonb),
    'grievances', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'reference', g.reference, 'subject', g.subject,
                              'status', g.status, 'created_at', g.created_at) order by g.created_at desc)
                              from public.grievances g where g.user_id = p.id), '[]'::jsonb))
    into out
    from public.profiles p join auth.users u on u.id = p.id
   where p.id = p_user_id;
  if out is null then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  return out;
end;
$$;


-- ------------------------------------------------------- privileges again
-- (create or replace keeps grants, restated for clarity.)
revoke all on function public.admin_resolution_preview(uuid) from public, anon, service_role;
grant execute on function public.admin_resolution_preview(uuid) to authenticated;
revoke all on function public.admin_user_detail(uuid) from public, anon, service_role;
grant execute on function public.admin_user_detail(uuid) to authenticated;

-- ---------------------------------------------------------------- backfill
-- Idempotent: finalizes positions of every market already resolved or voided
-- whose positions are not yet marked. Safe to run again (no-op).
do $$
declare
  m record;
  total integer := 0;
begin
  for m in select distinct p.market_id from public.positions p
             join public.markets k on k.id = p.market_id
            where k.status in ('resolved', 'voided') and not p.resolved loop
    total := total + public._finalize_positions(m.market_id);
  end loop;
  if total > 0 then
    perform public._audit(null, 'positions.backfill', 'market', null, null, jsonb_build_object('positions', total));
  end if;
end;
$$;
