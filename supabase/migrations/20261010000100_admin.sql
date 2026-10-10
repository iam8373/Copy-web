-- =============================================================================
-- 20261010000100_admin.sql — Admin phase R1: the admin and resolution layer.
--
-- Every admin write is a SECURITY DEFINER function that checks, inside the
-- database, that the caller (auth.uid() from the user's own JWT) is an active
-- staff member with the right role AND signed in with MFA (JWT aal = 'aal2').
-- The server cannot bypass this by mistake: it calls these functions with the
-- admin's session, never with the secret key. Each write appends to audit_log.
--
-- Roles: moderator = draft markets, propose resolutions, grievances.
--        admin     = everything, incl. publish/close, approve/finalize,
--                    credits, users, roles and settings.
--
-- Resolution: propose (market -> 'resolving') -> approve (typed slug; opens a
-- dispute window of app_settings.dispute_window_hours) -> finalize after the
-- window (pays 1 credit per winning share, or refunds every order on a void).
-- With require_two_person_resolution = false (single admin), the proposer may
-- approve; the proposal records self_approved = true and the audit says so.
--
-- Rollback (no data loss for users; admin history is dropped):
--   select cron.unschedule('bp-scheduled-jobs');            -- if pg_cron is on
--   drop function if exists public.admin_create_market(jsonb), … (all below);
--   drop table if exists public.resolution_proposals, public.outcome_translations;
--   alter table public.markets drop constraint markets_status_check,
--     add constraint markets_status_check check (status in ('draft','open','closed','resolved','voided'));
--   then restore place_order from 20261008000300_trading.sql.
-- =============================================================================

-- ------------------------------------------------------------------ schema
alter table public.markets drop constraint if exists markets_status_check;
alter table public.markets add constraint markets_status_check
  check (status in ('draft', 'open', 'closed', 'resolving', 'resolved', 'voided'));

alter table public.profiles
  add column if not exists suspended_reason text check (suspended_reason is null or char_length(suspended_reason) <= 500),
  add column if not exists suspended_at timestamptz;

alter table public.grievances
  add column if not exists reference text,
  add column if not exists category text not null default 'other'
    check (category in ('account', 'market', 'resolution', 'privacy', 'other')),
  add column if not exists admin_note text check (admin_note is null or char_length(admin_note) <= 5000),
  add column if not exists handled_by uuid references public.profiles (id) on delete set null,
  add column if not exists resolved_at timestamptz;
update public.grievances set reference = 'BP-' || upper(substr(md5(id::text), 1, 8)) where reference is null;
alter table public.grievances
  alter column reference set default ('BP-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))),
  alter column reference set not null;
create unique index if not exists grievances_reference_idx on public.grievances (reference);

-- A user is paid out (or refunded) at most once per market, enforced by the DB.
create unique index if not exists ledger_one_settlement_idx
  on public.ledger_entries (user_id, ref_id, type) where type in ('payout', 'refund');

create table public.resolution_proposals (
  id              uuid primary key default gen_random_uuid(),
  market_id       uuid not null references public.markets (id) on delete cascade,
  kind            text not null check (kind in ('outcome', 'void')),
  outcome_id      uuid,
  evidence_url    text not null check (evidence_url ~ '^https?://[^\s]+$' and char_length(evidence_url) <= 500),
  note            text not null check (char_length(note) between 3 and 2000),
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected', 'cancelled', 'finalized')),
  proposed_by     uuid references public.profiles (id) on delete set null,
  proposed_at     timestamptz not null default now(),
  approved_by     uuid references public.profiles (id) on delete set null,
  approved_at     timestamptz,
  self_approved   boolean not null default false,
  dispute_ends_at timestamptz,
  decided_by      uuid references public.profiles (id) on delete set null,
  decided_reason  text check (decided_reason is null or char_length(decided_reason) <= 2000),
  decided_at      timestamptz,
  finalized_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint resolution_outcome_matches_kind check ((kind = 'outcome') = (outcome_id is not null)),
  constraint resolution_outcome_in_market foreign key (outcome_id, market_id) references public.outcomes (id, market_id),
  constraint resolution_approved_fields check (
    (status in ('approved', 'finalized')) <= (approved_at is not null and dispute_ends_at is not null))
);
-- At most one live proposal per market.
create unique index resolution_one_active_idx on public.resolution_proposals (market_id)
  where status in ('pending', 'approved');
create index resolution_status_idx on public.resolution_proposals (status, dispute_ends_at);

create table public.outcome_translations (
  id          uuid primary key default gen_random_uuid(),
  outcome_id  uuid not null references public.outcomes (id) on delete cascade,
  locale      text not null check (locale in ('hi', 'mr', 'bn', 'ta', 'te')),
  label       text not null check (char_length(label) between 1 and 200),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  status      text not null default 'machine-drafted' check (status in ('machine-drafted', 'reviewed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (outcome_id, locale)
);

create trigger resolution_proposals_set_updated_at before update on public.resolution_proposals
  for each row execute function public.set_updated_at();
create trigger outcome_translations_set_updated_at before update on public.outcome_translations
  for each row execute function public.set_updated_at();

alter table public.resolution_proposals enable row level security;
alter table public.outcome_translations enable row level security;

-- Public resolution history: approved / finalized proposals of public markets.
-- Who proposed or approved is not exposed (column grants), only self_approved.
grant select (id, market_id, kind, outcome_id, evidence_url, note, status, approved_at,
              self_approved, dispute_ends_at, finalized_at)
  on public.resolution_proposals to anon, authenticated;
create policy resolution_public_read on public.resolution_proposals
  for select to anon, authenticated
  using (status in ('approved', 'finalized')
         and exists (select 1 from public.markets m where m.id = market_id and m.status <> 'draft'));

grant select on public.outcome_translations to anon, authenticated;
create policy outcome_translations_public_read on public.outcome_translations
  for select to anon, authenticated
  using (exists (select 1 from public.outcomes o join public.markets m on m.id = o.market_id
                  where o.id = outcome_id and m.status <> 'draft'));

-- Owner settings (R1). Insert-if-missing: never overwrite a value set since.
insert into public.app_settings (key, value) values
  ('dispute_window_hours', '24'::jsonb),
  ('require_two_person_resolution', 'false'::jsonb),
  ('staff_can_trade', 'false'::jsonb),
  ('daily_translation_cap', '50'::jsonb)
on conflict (key) do nothing;

-- ----------------------------------------------------------------- helpers
-- Internal helpers: no role may call them directly; they run inside the
-- SECURITY DEFINER functions below (same owner).

-- The calling staff member, or an error. p_min_role: 'moderator' | 'admin'.
create or replace function public._staff(p_min_role text)
returns public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  prof public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'BP_NOT_SIGNED_IN' using errcode = 'P0001'; end if;
  select * into prof from public.profiles where id = auth.uid();
  if not found or prof.status <> 'active' or prof.role not in ('moderator', 'admin')
     or (p_min_role = 'admin' and prof.role <> 'admin') then
    raise exception 'BP_FORBIDDEN' using errcode = 'P0001';
  end if;
  -- MFA is mandatory for staff: the session must be at assurance level 2.
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'BP_MFA_REQUIRED' using errcode = 'P0001';
  end if;
  return prof;
end;
$$;

create or replace function public._audit(
  p_actor uuid, p_action text, p_entity text, p_entity_id text, p_before jsonb, p_after jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (p_actor, p_action, p_entity, p_entity_id, p_before, p_after);
$$;

create or replace function public._setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$ select value from public.app_settings where key = p_key $$;

create or replace function public._market_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(m) - 'updated_at' || jsonb_build_object(
           'outcomes', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label) order by o.sort_order), '[]')
                          from public.outcomes o where o.market_id = m.id))
    from public.markets m where m.id = p_id
$$;

-- Typed-slug confirmation for destructive / money-moving actions.
create or replace function public._confirm(p_slug text, p_typed text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_typed is null or p_typed <> p_slug then
    raise exception 'BP_CONFIRM_MISMATCH' using errcode = 'P0001';
  end if;
end;
$$;

-- Reads and validates the editable market fields from a jsonb payload.
-- Returns the outcome labels to (re)create, or null when not given.
create or replace function public._outcome_labels(p jsonb, p_is_binary boolean)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  labels text[];
begin
  if p_is_binary then return array['Yes', 'No']; end if;
  if not (p ? 'outcomes') then return null; end if;
  if jsonb_typeof(p -> 'outcomes') <> 'array' then raise exception 'BP_INVALID_INPUT' using errcode = 'P0001'; end if;
  select array_agg(btrim(x) order by n) into labels
    from jsonb_array_elements_text(p -> 'outcomes') with ordinality as t(x, n);
  if labels is null or array_length(labels, 1) not between 3 and 20
     or exists (select 1 from unnest(labels) l where char_length(l) not between 1 and 80)
     or (select count(distinct lower(l)) from unnest(labels) l) <> array_length(labels, 1) then
    raise exception 'BP_INVALID_INPUT' using errcode = 'P0001';
  end if;
  return labels;
end;
$$;

create or replace function public._replace_outcomes(p_market uuid, p_labels text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.outcomes where market_id = p_market;
  insert into public.outcomes (market_id, label, sort_order, price, shares_outstanding)
  select p_market, l.label, l.ord - 1, round(1.0 / array_length(p_labels, 1), 10), 0
    from unnest(p_labels) with ordinality as l(label, ord);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public._staff(text)', 'public._audit(uuid,text,text,text,jsonb,jsonb)',
                           'public._setting(text)', 'public._market_json(uuid)', 'public._confirm(text,text)',
                           'public._outcome_labels(jsonb,boolean)', 'public._replace_outcomes(uuid,text[])']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
end;
$$;

-- ----------------------------------------------------------------- markets
-- Payload keys: slug, title, description, category, subcategory, end_date,
-- resolution_source, is_binary, outcomes (3–20 labels when not binary),
-- liquidity_b, is_featured, is_live. New markets start as drafts.
create or replace function public.admin_create_market(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     public.profiles%rowtype := public._staff('moderator');
  is_bin boolean := coalesce((p ->> 'is_binary')::boolean, true);
  labels text[] := public._outcome_labels(p, is_bin);
  new_id uuid;
begin
  if labels is null then raise exception 'BP_INVALID_INPUT' using errcode = 'P0001'; end if;
  begin
    insert into public.markets (slug, title, description, category, subcategory, end_date,
                                resolution_source, is_binary, liquidity_b, is_featured, is_live,
                                status, created_by)
    values (p ->> 'slug', btrim(p ->> 'title'), coalesce(p ->> 'description', ''), p ->> 'category',
            btrim(p ->> 'subcategory'), (p ->> 'end_date')::timestamptz,
            coalesce(p ->> 'resolution_source', ''), is_bin,
            coalesce((p ->> 'liquidity_b')::numeric, (public._setting('default_liquidity_b') #>> '{}')::numeric, 20000),
            coalesce((p ->> 'is_featured')::boolean, false), coalesce((p ->> 'is_live')::boolean, false),
            'draft', me.id)
    returning id into new_id;
  exception
    when unique_violation then raise exception 'BP_SLUG_TAKEN' using errcode = 'P0001';
    when check_violation or not_null_violation or invalid_text_representation
      or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
      raise exception 'BP_INVALID_INPUT' using errcode = 'P0001';
  end;
  if (p ->> 'liquidity_b') is not null and (p ->> 'liquidity_b')::numeric not between 100 and 10000000 then
    raise exception 'BP_INVALID_INPUT' using errcode = 'P0001';
  end if;
  perform public._replace_outcomes(new_id, labels);
  perform public._audit(me.id, 'market.create', 'market', new_id::text, null, public._market_json(new_id));
  return new_id;
end;
$$;

-- Drafts: every field. Open/closed: wording, flags and (open only) a future
-- end date — never outcomes, type or liquidity, which would move prices.
create or replace function public.admin_update_market(p_market_id uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      public.profiles%rowtype := public._staff('moderator');
  mkt     public.markets%rowtype;
  before  jsonb;
  k       text;
  is_bin  boolean;
  labels  text[];
  allowed text[];
begin
  select * into mkt from public.markets where id = p_market_id for update;
  if not found then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  allowed := case mkt.status
    when 'draft' then array['slug', 'title', 'description', 'category', 'subcategory', 'end_date', 'resolution_source',
                            'is_binary', 'outcomes', 'liquidity_b', 'is_featured', 'is_live']
    when 'open' then array['title', 'description', 'subcategory', 'end_date', 'resolution_source', 'is_featured', 'is_live']
    when 'closed' then array['title', 'description', 'subcategory', 'resolution_source', 'is_featured', 'is_live']
    else array[]::text[] end;
  for k in select jsonb_object_keys(p) loop
    if not (k = any (allowed)) then raise exception 'BP_FIELD_LOCKED' using errcode = 'P0001'; end if;
  end loop;
  if mkt.status = 'open' and p ? 'end_date' and (p ->> 'end_date')::timestamptz <= now() then
    raise exception 'BP_INVALID_INPUT' using errcode = 'P0001';
  end if;
  if (p ->> 'liquidity_b') is not null and (p ->> 'liquidity_b')::numeric not between 100 and 10000000 then
    raise exception 'BP_INVALID_INPUT' using errcode = 'P0001';
  end if;
  before := public._market_json(p_market_id);
  begin
    update public.markets set
      slug              = coalesce(p ->> 'slug', slug),
      title             = coalesce(btrim(p ->> 'title'), title),
      description       = coalesce(p ->> 'description', description),
      category          = coalesce(p ->> 'category', category),
      subcategory       = coalesce(btrim(p ->> 'subcategory'), subcategory),
      end_date          = coalesce((p ->> 'end_date')::timestamptz, end_date),
      resolution_source = coalesce(p ->> 'resolution_source', resolution_source),
      is_binary         = coalesce((p ->> 'is_binary')::boolean, is_binary),
      liquidity_b       = coalesce((p ->> 'liquidity_b')::numeric, liquidity_b),
      is_featured       = coalesce((p ->> 'is_featured')::boolean, is_featured),
      is_live           = coalesce((p ->> 'is_live')::boolean, is_live)
    where id = p_market_id
    returning is_binary into is_bin;
  exception
    when unique_violation then raise exception 'BP_SLUG_TAKEN' using errcode = 'P0001';
    when check_violation or not_null_violation or invalid_text_representation
      or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
      raise exception 'BP_INVALID_INPUT' using errcode = 'P0001';
  end;
  if mkt.status = 'draft' and (p ? 'outcomes' or p ? 'is_binary') then
    labels := public._outcome_labels(p, is_bin);
    if labels is null then raise exception 'BP_INVALID_INPUT' using errcode = 'P0001'; end if;
    perform public._replace_outcomes(p_market_id, labels);
  end if;
  perform public._audit(me.id, 'market.update', 'market', p_market_id::text, before, public._market_json(p_market_id));
end;
$$;

create or replace function public.admin_publish_market(p_market_id uuid, p_confirm_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  public.profiles%rowtype := public._staff('admin');
  mkt public.markets%rowtype;
  n   integer;
begin
  select * into mkt from public.markets where id = p_market_id for update;
  if not found then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  perform public._confirm(mkt.slug, p_confirm_slug);
  if mkt.status <> 'draft' then raise exception 'BP_WRONG_STATUS' using errcode = 'P0001'; end if;
  select count(*) into n from public.outcomes where market_id = p_market_id;
  if mkt.end_date <= now() or n < 2 or (mkt.is_binary and n <> 2) or mkt.resolution_source = '' then
    raise exception 'BP_NOT_READY' using errcode = 'P0001';
  end if;
  update public.markets set status = 'open' where id = p_market_id;
  perform public._audit(me.id, 'market.publish', 'market', p_market_id::text,
    jsonb_build_object('status', 'draft'), jsonb_build_object('status', 'open'));
end;
$$;

-- Closes trading early (end dates close markets automatically, see below).
create or replace function public.admin_close_market(p_market_id uuid, p_confirm_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  public.profiles%rowtype := public._staff('admin');
  mkt public.markets%rowtype;
begin
  select * into mkt from public.markets where id = p_market_id for update;
  if not found then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  perform public._confirm(mkt.slug, p_confirm_slug);
  if mkt.status <> 'open' then raise exception 'BP_WRONG_STATUS' using errcode = 'P0001'; end if;
  update public.markets set status = 'closed', is_live = false where id = p_market_id;
  perform public._audit(me.id, 'market.close', 'market', p_market_id::text,
    jsonb_build_object('status', 'open', 'end_date', mkt.end_date), jsonb_build_object('status', 'closed'));
end;
$$;

-- -------------------------------------------------------------- resolution
-- p_outcome_id null = propose voiding the market (every order refunded).
create or replace function public.propose_resolution(
  p_market_id uuid, p_outcome_id uuid, p_evidence_url text, p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     public.profiles%rowtype := public._staff('moderator');
  mkt    public.markets%rowtype;
  new_id uuid;
begin
  select * into mkt from public.markets where id = p_market_id for update;
  if not found then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  -- Trading must have stopped: closed, or open past its end date.
  if not (mkt.status = 'closed' or (mkt.status = 'open' and mkt.end_date <= now())) then
    raise exception 'BP_WRONG_STATUS' using errcode = 'P0001';
  end if;
  if p_outcome_id is not null and not exists (select 1 from public.outcomes where id = p_outcome_id and market_id = p_market_id) then
    raise exception 'BP_INVALID_INPUT' using errcode = 'P0001';
  end if;
  begin
    insert into public.resolution_proposals (market_id, kind, outcome_id, evidence_url, note, proposed_by)
    values (p_market_id, case when p_outcome_id is null then 'void' else 'outcome' end, p_outcome_id,
            btrim(p_evidence_url), btrim(p_note), me.id)
    returning id into new_id;
  exception
    when unique_violation then raise exception 'BP_ALREADY_PROPOSED' using errcode = 'P0001';
    when check_violation or not_null_violation then raise exception 'BP_INVALID_INPUT' using errcode = 'P0001';
  end;
  update public.markets set status = 'resolving', is_live = false where id = p_market_id;
  perform public._audit(me.id, 'resolution.propose', 'resolution', new_id::text,
    jsonb_build_object('market_status', mkt.status),
    jsonb_build_object('market_id', p_market_id, 'kind', case when p_outcome_id is null then 'void' else 'outcome' end,
                       'outcome_id', p_outcome_id, 'evidence_url', p_evidence_url, 'note', p_note));
  return new_id;
end;
$$;

create or replace function public.approve_resolution(p_proposal_id uuid, p_confirm_slug text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me    public.profiles%rowtype := public._staff('admin');
  prop  public.resolution_proposals%rowtype;
  mkt   public.markets%rowtype;
  hours numeric := coalesce((public._setting('dispute_window_hours') #>> '{}')::numeric, 24);
  two   boolean := coalesce((public._setting('require_two_person_resolution') #>> '{}')::boolean, true);
  ends  timestamptz;
  self  boolean;
begin
  select * into prop from public.resolution_proposals where id = p_proposal_id for update;
  if not found then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  select * into mkt from public.markets where id = prop.market_id for update;
  perform public._confirm(mkt.slug, p_confirm_slug);
  if prop.status <> 'pending' then raise exception 'BP_WRONG_STATUS' using errcode = 'P0001'; end if;
  self := prop.proposed_by is not distinct from me.id;
  if self and two then raise exception 'BP_SECOND_PERSON_REQUIRED' using errcode = 'P0001'; end if;
  ends := now() + make_interval(secs => (greatest(hours, 0) * 3600)::double precision);
  update public.resolution_proposals
     set status = 'approved', approved_by = me.id, approved_at = now(), self_approved = self, dispute_ends_at = ends
   where id = p_proposal_id;
  perform public._audit(me.id, case when self then 'resolution.approve_self' else 'resolution.approve' end,
    'resolution', p_proposal_id::text, jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'approved', 'self_approved', self, 'two_person_required', two,
                       'dispute_ends_at', ends, 'market_id', prop.market_id));
  return ends;
end;
$$;

-- Pending proposal turned down, or an approved one withdrawn during the
-- dispute window (e.g. a valid dispute). The market goes back to 'closed'.
create or replace function public.reject_resolution(p_proposal_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   public.profiles%rowtype := public._staff('admin');
  prop public.resolution_proposals%rowtype;
  new_status text;
begin
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 2000 then
    raise exception 'BP_INVALID_INPUT' using errcode = 'P0001';
  end if;
  select * into prop from public.resolution_proposals where id = p_proposal_id for update;
  if not found then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  if prop.status = 'pending' then new_status := 'rejected';
  elsif prop.status = 'approved' then new_status := 'cancelled';
  else raise exception 'BP_WRONG_STATUS' using errcode = 'P0001';
  end if;
  update public.resolution_proposals
     set status = new_status, decided_by = me.id, decided_reason = btrim(p_reason), decided_at = now()
   where id = p_proposal_id;
  update public.markets set status = 'closed' where id = prop.market_id and status = 'resolving';
  perform public._audit(me.id, 'resolution.' || case new_status when 'rejected' then 'reject' else 'cancel' end,
    'resolution', p_proposal_id::text, jsonb_build_object('status', prop.status),
    jsonb_build_object('status', new_status, 'reason', btrim(p_reason), 'market_id', prop.market_id));
end;
$$;

-- Pays out an approved proposal whose dispute window has ended. Internal.
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
    -- Void: every order on the market is refunded at cost.
    with refunded as (
      insert into public.ledger_entries (user_id, amount, type, ref_id, note)
      select o.user_id, sum(o.amount), 'refund', mkt.id, 'Refund (market voided): ' || left(mkt.title, 380)
        from public.orders o where o.market_id = mkt.id
       group by o.user_id having sum(o.amount) > 0
      returning amount)
    select count(*), coalesce(sum(amount), 0) into users, total from refunded;
    update public.markets set status = 'voided', resolved_at = now() where id = mkt.id;
  end if;

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

create or replace function public.finalize_resolution(p_proposal_id uuid, p_confirm_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  public.profiles%rowtype := public._staff('admin');
  slug text;
begin
  select m.slug into slug from public.resolution_proposals r join public.markets m on m.id = r.market_id
   where r.id = p_proposal_id;
  if slug is null then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  perform public._confirm(slug, p_confirm_slug);
  return public._settle(p_proposal_id, me.id);
end;
$$;

-- ------------------------------------------------------------ scheduled jobs
-- Closes markets past their end date and finalizes approved proposals whose
-- dispute window has ended. Runs every minute via pg_cron when available,
-- otherwise via POST /api/cron (CRON_SECRET). Safe to run at any time.
create or replace function public.run_scheduled_jobs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  closed    integer;
  finalized integer := 0;
  r         record;
begin
  with c as (
    update public.markets set status = 'closed', is_live = false
     where status = 'open' and end_date <= now()
    returning id)
  select count(*) into closed from c;
  if closed > 0 then
    perform public._audit(null, 'market.auto_close', 'market', null, null, jsonb_build_object('count', closed));
  end if;
  for r in select id from public.resolution_proposals
            where status = 'approved' and dispute_ends_at <= now() order by dispute_ends_at limit 50 loop
    begin
      perform public._settle(r.id, null);
      finalized := finalized + 1;
    exception when others then
      perform public._audit(null, 'resolution.finalize_failed', 'resolution', r.id::text, null,
        jsonb_build_object('error', left(sqlerrm, 300)));
    end;
  end loop;
  return jsonb_build_object('closed', closed, 'finalized', finalized);
end;
$$;

-- ------------------------------------------------------------ users/credits
create or replace function public.admin_adjust_credits(p_user_id uuid, p_amount numeric, p_reason text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  public.profiles%rowtype := public._staff('admin');
  cap numeric := coalesce((public._setting('admin_credit_cap') #>> '{}')::numeric, 10000);
  bal numeric;
  entry uuid;
begin
  if p_user_id = me.id then raise exception 'BP_SELF_ACTION' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount = 0 or p_amount <> round(p_amount, 2) or abs(p_amount) > cap then
    raise exception 'BP_INVALID_AMOUNT' using errcode = 'P0001';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then
    raise exception 'BP_INVALID_INPUT' using errcode = 'P0001';
  end if;
  select balance into bal from public.wallets where user_id = p_user_id for update;
  if not found then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  if bal + p_amount < 0 then raise exception 'BP_INSUFFICIENT_FUNDS' using errcode = 'P0001'; end if;
  insert into public.ledger_entries (user_id, amount, type, note)
  values (p_user_id, p_amount, 'admin_adjustment', btrim(p_reason))
  returning id into entry;
  perform public._audit(me.id, 'credits.adjust', 'profile', p_user_id::text, jsonb_build_object('balance', bal),
    jsonb_build_object('balance', bal + p_amount, 'amount', p_amount, 'reason', btrim(p_reason), 'ledger_id', entry));
  return bal + p_amount;
end;
$$;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     public.profiles%rowtype := public._staff('admin');
  target public.profiles%rowtype;
begin
  if p_user_id = me.id then raise exception 'BP_SELF_ACTION' using errcode = 'P0001'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'BP_INVALID_INPUT' using errcode = 'P0001'; end if;
  if p_status = 'suspended' and (p_reason is null or char_length(btrim(p_reason)) not between 3 and 500) then
    raise exception 'BP_INVALID_INPUT' using errcode = 'P0001';
  end if;
  select * into target from public.profiles where id = p_user_id for update;
  if not found then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  -- An admin must be demoted before being suspended.
  if target.role = 'admin' then raise exception 'BP_FORBIDDEN' using errcode = 'P0001'; end if;
  update public.profiles
     set status = p_status,
         suspended_reason = case when p_status = 'suspended' then btrim(p_reason) end,
         suspended_at = case when p_status = 'suspended' then now() end
   where id = p_user_id;
  perform public._audit(me.id, 'user.' || case when p_status = 'suspended' then 'suspend' else 'reinstate' end,
    'profile', p_user_id::text, jsonb_build_object('status', target.status, 'reason', target.suspended_reason),
    jsonb_build_object('status', p_status, 'reason', nullif(btrim(coalesce(p_reason, '')), '')));
end;
$$;

create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     public.profiles%rowtype := public._staff('admin');
  target public.profiles%rowtype;
begin
  if p_user_id = me.id then raise exception 'BP_SELF_ACTION' using errcode = 'P0001'; end if;
  if p_role not in ('user', 'moderator', 'admin') then raise exception 'BP_INVALID_INPUT' using errcode = 'P0001'; end if;
  -- Serialise role changes so two admins cannot demote each other at once.
  perform 1 from public.profiles where role = 'admin' for update;
  select * into target from public.profiles where id = p_user_id for update;
  if not found then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  if target.status <> 'active' and p_role <> 'user' then raise exception 'BP_FORBIDDEN' using errcode = 'P0001'; end if;
  if target.role = 'admin' and p_role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin' and status = 'active') <= 1 then
    raise exception 'BP_LAST_ADMIN' using errcode = 'P0001';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  perform public._audit(me.id, 'user.role', 'profile', p_user_id::text,
    jsonb_build_object('role', target.role), jsonb_build_object('role', p_role));
end;
$$;

-- Whitelisted settings with validation. Unknown keys are refused.
create or replace function public.admin_update_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     public.profiles%rowtype := public._staff('admin');
  before jsonb := public._setting(p_key);
  ok     boolean;
  n      numeric;
begin
  if p_key in ('trading_enabled', 'require_two_person_resolution', 'staff_can_trade') then
    ok := jsonb_typeof(p_value) = 'boolean';
  elsif p_key in ('min_trade', 'max_trade', 'signup_credit', 'admin_credit_cap', 'default_liquidity_b',
                  'dispute_window_hours', 'daily_translation_cap') then
    ok := jsonb_typeof(p_value) = 'number';
    if ok then
      n := (p_value #>> '{}')::numeric;
      ok := case p_key
        when 'min_trade' then n >= 1 and n = round(n, 2)
                              and n <= coalesce((public._setting('max_trade') #>> '{}')::numeric, 100000)
        when 'max_trade' then n = round(n, 2) and n <= 10000000
                              and n >= coalesce((public._setting('min_trade') #>> '{}')::numeric, 1)
        when 'signup_credit' then n between 0 and 1000000 and n = round(n, 2)
        when 'admin_credit_cap' then n between 1 and 1000000 and n = round(n, 2)
        when 'default_liquidity_b' then n between 100 and 10000000
        when 'dispute_window_hours' then n between 0 and 720 and n = trunc(n)
        when 'daily_translation_cap' then n between 0 and 1000 and n = trunc(n)
      end;
    end if;
  else
    raise exception 'BP_UNKNOWN_SETTING' using errcode = 'P0001';
  end if;
  if not coalesce(ok, false) then raise exception 'BP_INVALID_INPUT' using errcode = 'P0001'; end if;
  insert into public.app_settings (key, value, updated_by) values (p_key, p_value, me.id)
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by;
  perform public._audit(me.id, 'setting.update', 'setting', p_key,
    jsonb_build_object('value', before), jsonb_build_object('value', p_value));
end;
$$;

create or replace function public.admin_update_grievance(p_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.profiles%rowtype := public._staff('moderator');
  g  public.grievances%rowtype;
begin
  if p_status not in ('open', 'in_progress', 'resolved', 'closed')
     or (p_note is not null and char_length(p_note) > 5000) then
    raise exception 'BP_INVALID_INPUT' using errcode = 'P0001';
  end if;
  select * into g from public.grievances where id = p_id for update;
  if not found then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  update public.grievances
     set status = p_status, admin_note = coalesce(p_note, admin_note), handled_by = me.id,
         resolved_at = case when p_status in ('resolved', 'closed') then coalesce(resolved_at, now()) end
   where id = p_id;
  perform public._audit(me.id, 'grievance.update', 'grievance', p_id::text,
    jsonb_build_object('status', g.status), jsonb_build_object('status', p_status, 'note_changed', p_note is not null));
end;
$$;

-- Bootstrap: make an existing account an admin by email. Secret key only
-- (npm run admin:grant -- <email>); there is no client path to this.
create or replace function public.admin_grant_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid  uuid;
  prev text;
begin
  select u.id into uid from auth.users u where lower(u.email) = lower(btrim(p_email));
  if uid is null then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  select role into prev from public.profiles where id = uid for update;
  if prev is null then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  update public.profiles set role = 'admin', status = 'active', suspended_reason = null, suspended_at = null where id = uid;
  perform public._audit(null, 'user.role_cli', 'profile', uid::text, jsonb_build_object('role', prev),
    jsonb_build_object('role', 'admin', 'by', 'admin:grant'));
  return uid;
end;
$$;

-- -------------------------------------------------------------- privileges
do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_create_market(jsonb)', 'public.admin_update_market(uuid,jsonb)',
    'public.admin_publish_market(uuid,text)', 'public.admin_close_market(uuid,text)',
    'public.propose_resolution(uuid,uuid,text,text)', 'public.approve_resolution(uuid,text)',
    'public.reject_resolution(uuid,text)', 'public.finalize_resolution(uuid,text)',
    'public.admin_adjust_credits(uuid,numeric,text)', 'public.admin_set_user_status(uuid,text,text)',
    'public.admin_set_role(uuid,text)', 'public.admin_update_setting(text,jsonb)',
    'public.admin_update_grievance(uuid,text,text)']
  loop
    execute format('revoke all on function %s from public, anon, service_role', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.run_scheduled_jobs()', 'public.admin_grant_by_email(text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- pg_cron (Supabase Cron) when the project has it; otherwise /api/cron.
do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron unavailable (%); schedule POST /api/cron instead', sqlerrm;
    return;
  end;
  begin
    perform cron.schedule('bp-scheduled-jobs', '* * * * *', 'select public.run_scheduled_jobs()');
  exception when others then
    raise notice 'could not schedule bp-scheduled-jobs (%); use POST /api/cron', sqlerrm;
  end;
end;
$$;

-- ------------------------------------------------- place_order: staff block
-- Same as 20261008000300_trading.sql plus the staff_can_trade check.
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
