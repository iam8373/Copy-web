-- =============================================================================
-- 20261001000100_core_schema.sql
-- Core tables for BharatPredict. Virtual play credits only: there is no real
-- money anywhere in this schema. The wallet is an append-only ledger so real
-- money could be layered on later, after legal review.
--
-- Rollback: drop the tables in reverse dependency order, e.g.
--   drop table if exists public.app_settings, public.grievances, public.audit_log,
--     public.price_history, public.positions, public.orders, public.ledger_entries,
--     public.wallets, public.market_translations, public.outcomes, public.markets,
--     public.profiles cascade;
--   drop function if exists public.set_updated_at, public.forbid_mutation,
--     public.apply_ledger_entry;
-- (Destroys all data. Take a backup first.)
-- =============================================================================

-- Shared trigger: keep updated_at honest on mutable tables.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Shared trigger: append-only tables reject UPDATE and DELETE for everyone,
-- including the service role (triggers are not bypassed by BYPASSRLS).
create or replace function public.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only: % is not allowed', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles: one row per auth user. Created by a trigger on auth.users (Phase 2).
-- -----------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  handle           text not null unique check (char_length(handle) between 1 and 64),
  display_name     text check (display_name is null or char_length(display_name) <= 80),
  language         text not null default 'en'
                   check (language in ('en', 'hi', 'mr', 'bn', 'ta', 'te')),
  role             text not null default 'user'
                   check (role in ('user', 'moderator', 'admin')),
  age_confirmed_at timestamptz,
  terms_version    text check (terms_version is null or char_length(terms_version) <= 32),
  status           text not null default 'active' check (status in ('active', 'suspended')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- markets
-- -----------------------------------------------------------------------------
create table public.markets (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique
                      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 96),
  title               text not null check (char_length(title) between 3 and 200),
  description         text not null default '' check (char_length(description) <= 4000),
  -- Must match CATEGORIES in src/lib/types.ts (a test enforces this).
  category            text not null check (category in (
                        'cricket', 'politics', 'entertainment', 'economy', 'finance',
                        'sports', 'esports', 'tech', 'world-news', 'war', 'ai')),
  subcategory         text not null check (char_length(subcategory) between 1 and 60),
  end_date            timestamptz not null,
  is_live             boolean not null default false,
  is_featured         boolean not null default false,
  resolution_source   text not null default '' check (char_length(resolution_source) <= 300),
  status              text not null default 'draft'
                      check (status in ('draft', 'open', 'closed', 'resolved', 'voided')),
  is_binary           boolean not null default true,
  -- LMSR liquidity parameter. Max market-maker loss is b * ln(#outcomes).
  liquidity_b         numeric(14, 4) not null default 1000 check (liquidity_b > 0),
  total_volume        numeric(18, 2) not null default 0 check (total_volume >= 0),
  volume_change_24h   numeric(18, 2) not null default 0,
  resolved_outcome_id uuid,
  resolved_at         timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  -- The old static id (mkt_001…) from src/data/markets.ts. Lets the seed
  -- script stay idempotent and maps legacy translation keys. Null for markets
  -- created in the admin panel.
  legacy_id           text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint markets_resolution_consistent check (
    (status = 'resolved') = (resolved_outcome_id is not null)
    and (status not in ('resolved', 'voided') or resolved_at is not null)
  )
);

create index markets_status_category_idx on public.markets (status, category);
create index markets_live_idx on public.markets (is_live) where is_live;
create index markets_featured_idx on public.markets (is_featured) where is_featured;

-- -----------------------------------------------------------------------------
-- outcomes
-- -----------------------------------------------------------------------------
create table public.outcomes (
  id                 uuid primary key default gen_random_uuid(),
  market_id          uuid not null references public.markets (id) on delete cascade,
  label              text not null check (char_length(label) between 1 and 80),
  sort_order         integer not null default 0 check (sort_order >= 0),
  -- LMSR quantity q_i. Price_i = exp(q_i/b) / sum_j exp(q_j/b).
  shares_outstanding numeric(24, 8) not null default 0,
  -- Cached price for reads; recomputed inside place_order (Phase 4).
  price              numeric(12, 10) not null check (price >= 0 and price <= 1),
  -- The old static outcome id ('yes', 'mumbai-indians'…), for idempotent seeding.
  legacy_key         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (market_id, sort_order),
  unique (market_id, label),
  -- Lets other tables prove an outcome belongs to the market they name.
  unique (id, market_id)
);

create index outcomes_market_idx on public.outcomes (market_id);

alter table public.markets
  add constraint markets_resolved_outcome_fk
  foreign key (resolved_outcome_id, id) references public.outcomes (id, market_id);

-- -----------------------------------------------------------------------------
-- market_translations (saved once, read by users; Phase 7 writes them)
-- -----------------------------------------------------------------------------
create table public.market_translations (
  id            uuid primary key default gen_random_uuid(),
  market_id     uuid not null references public.markets (id) on delete cascade,
  locale        text not null check (locale in ('hi', 'mr', 'bn', 'ta', 'te')),
  title         text not null check (char_length(title) between 1 and 400),
  description   text not null default '' check (char_length(description) <= 8000),
  source_hash   text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  status        text not null default 'machine-drafted'
                check (status in ('machine-drafted', 'reviewed')),
  translated_at timestamptz not null default now(),
  reviewed_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (market_id, locale)
);

-- -----------------------------------------------------------------------------
-- wallets + ledger_entries. Balance = sum(ledger). The cached balance is kept
-- in step by a trigger and CHECKed >= 0, so no insert can overdraw a wallet.
-- -----------------------------------------------------------------------------
create table public.wallets (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  balance    numeric(18, 2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ledger_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.wallets (user_id) on delete restrict,
  amount     numeric(18, 2) not null check (amount <> 0),
  type       text not null
             check (type in ('signup_credit', 'trade', 'payout', 'refund', 'admin_adjustment')),
  ref_id     uuid,
  note       text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index ledger_user_created_idx on public.ledger_entries (user_id, created_at desc);
-- The signup credit can be granted at most once per user, enforced by the DB.
create unique index ledger_one_signup_credit_idx
  on public.ledger_entries (user_id) where type = 'signup_credit';

-- Applies each ledger row to the cached balance in the same statement. If the
-- result would be negative, the wallets CHECK fails and the insert is rolled
-- back with it.
create or replace function public.apply_ledger_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.wallets
     set balance = balance + new.amount
   where user_id = new.user_id;
  if not found then
    raise exception 'no wallet for user %', new.user_id using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger ledger_apply_to_wallet
  before insert on public.ledger_entries
  for each row execute function public.apply_ledger_entry();

create trigger ledger_append_only
  before update or delete on public.ledger_entries
  for each row execute function public.forbid_mutation();

-- -----------------------------------------------------------------------------
-- orders (immutable fills)
-- -----------------------------------------------------------------------------
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete restrict,
  market_id       uuid not null references public.markets (id) on delete restrict,
  outcome_id      uuid not null,
  side            text not null default 'buy' check (side = 'buy'),
  amount          numeric(18, 2) not null check (amount > 0),
  shares          numeric(24, 8) not null check (shares > 0),
  avg_price       numeric(12, 10) not null check (avg_price > 0 and avg_price <= 1),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  created_at      timestamptz not null default now(),
  unique (user_id, idempotency_key),
  foreign key (outcome_id, market_id) references public.outcomes (id, market_id)
);

create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_market_created_idx on public.orders (market_id, created_at desc);

create trigger orders_append_only
  before update or delete on public.orders
  for each row execute function public.forbid_mutation();

-- -----------------------------------------------------------------------------
-- positions
-- -----------------------------------------------------------------------------
create table public.positions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete restrict,
  market_id    uuid not null references public.markets (id) on delete restrict,
  outcome_id   uuid not null,
  shares       numeric(24, 8) not null default 0 check (shares >= 0),
  avg_price    numeric(12, 10) not null default 0 check (avg_price >= 0 and avg_price <= 1),
  realized_pnl numeric(18, 2) not null default 0,
  resolved     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, outcome_id),
  foreign key (outcome_id, market_id) references public.outcomes (id, market_id)
);

create index positions_user_idx on public.positions (user_id);
create index positions_market_idx on public.positions (market_id);

-- -----------------------------------------------------------------------------
-- price_history (append-only time series for charts)
-- -----------------------------------------------------------------------------
create table public.price_history (
  id         uuid primary key default gen_random_uuid(),
  market_id  uuid not null references public.markets (id) on delete cascade,
  outcome_id uuid not null,
  price      numeric(12, 10) not null check (price >= 0 and price <= 1),
  volume     numeric(18, 2) not null default 0 check (volume >= 0),
  at         timestamptz not null default now(),
  foreign key (outcome_id, market_id) references public.outcomes (id, market_id) on delete cascade
);

create index price_history_market_at_idx on public.price_history (market_id, at desc);
create index price_history_outcome_at_idx on public.price_history (outcome_id, at desc);

create trigger price_history_append_only
  before update or delete on public.price_history
  for each row execute function public.forbid_mutation();

-- -----------------------------------------------------------------------------
-- audit_log (append-only for everyone)
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null check (char_length(action) between 1 and 64),
  entity     text not null check (char_length(entity) between 1 and 64),
  entity_id  text,
  before     jsonb,
  after      jsonb,
  ip         inet,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function public.forbid_mutation();

-- -----------------------------------------------------------------------------
-- grievances (public form writes via a server action, Phase 8)
-- -----------------------------------------------------------------------------
create table public.grievances (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  name       text not null check (char_length(name) between 1 and 120),
  email      text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject    text not null check (char_length(subject) between 1 and 200),
  message    text not null check (char_length(message) between 1 and 5000),
  status     text not null default 'open'
             check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index grievances_status_created_idx on public.grievances (status, created_at desc);

-- -----------------------------------------------------------------------------
-- app_settings (kill switch, limits). Read on the server only.
-- -----------------------------------------------------------------------------
create table public.app_settings (
  key        text primary key check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  value      jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at triggers on every mutable table.
do $$
declare t text;
begin
  foreach t in array array['profiles', 'markets', 'outcomes', 'market_translations', 'wallets',
                           'positions', 'grievances', 'app_settings']
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t);
  end loop;
end;
$$;
