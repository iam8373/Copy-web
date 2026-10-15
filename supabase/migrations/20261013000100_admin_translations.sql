-- =============================================================================
-- 20261013000100_admin_translations.sql — Admin R5: translations admin.
--
-- Saved translations (market title/description, outcome labels) are written
-- only through these functions. The source hash is computed HERE from the
-- current English text, so a saved entry can never claim to match text it
-- was not made from. Machine drafts never overwrite a reviewed entry that is
-- still current; a reviewed entry for older English text is stale (not shown
-- to users) and may be replaced. Gemini calls are capped per IST day by
-- app_settings.daily_translation_cap (one unit per market translated).
--
-- Rollback:
--   drop function if exists public.admin_save_market_translation(uuid, text, text, text, text),
--     public.admin_save_outcome_translation(uuid, text, text, text),
--     public.admin_take_translation_quota(uuid), public.translation_quota_used(),
--     public.market_source_hash(uuid), public.outcome_source_hash(text),
--     public.admin_translation_source(uuid);
-- =============================================================================

-- Same as sourceHashFor() in src/services/translation/hash.ts.
create or replace function public.market_source_hash(p_market_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(sha256(convert_to(m.title || E'\n' || m.description || E'\n' || m.subcategory, 'UTF8')), 'hex')
    from public.markets m where m.id = p_market_id
$$;

-- Outcome labels: sha256 of the English label (outcomeHashFor in hash.ts).
create or replace function public.outcome_source_hash(p_label text)
returns text
language sql
immutable
set search_path = ''
as $$ select encode(sha256(convert_to(p_label, 'UTF8')), 'hex') $$;

grant execute on function public.outcome_source_hash(text) to anon, authenticated, service_role;
revoke all on function public.market_source_hash(uuid) from public, anon, authenticated, service_role;

-- Units used today (IST).
create or replace function public.translation_quota_used()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.audit_log
   where action = 'translation.generate'
     and created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')
$$;
revoke all on function public.translation_quota_used() from public, anon, authenticated, service_role;

-- Takes one unit of today's quota for a market, or refuses (BP_DAILY_CAP).
-- Returns the units left. Serialised so two staff cannot both take the last.
create or replace function public.admin_take_translation_quota(p_market_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   public.profiles%rowtype := public._staff('moderator');
  cap  integer := coalesce((public._setting('daily_translation_cap') #>> '{}')::integer, 50);
  used integer;
begin
  if not exists (select 1 from public.markets where id = p_market_id) then
    raise exception 'BP_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('bp_translation_quota'));
  used := public.translation_quota_used();
  if used >= cap then raise exception 'BP_DAILY_CAP' using errcode = 'P0001'; end if;
  perform public._audit(me.id, 'translation.generate', 'market', p_market_id::text, null,
    jsonb_build_object('used', used + 1, 'cap', cap));
  return cap - used - 1;
end;
$$;

-- Saves one locale of a market's text. p_status: 'machine-drafted' | 'reviewed'.
-- Returns false when a machine draft was skipped to keep a current reviewed entry.
create or replace function public.admin_save_market_translation(
  p_market_id uuid, p_locale text, p_title text, p_description text, p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   public.profiles%rowtype := public._staff('moderator');
  hash text := public.market_source_hash(p_market_id);
  cur  public.market_translations%rowtype;
  existed boolean;
begin
  if hash is null then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  if p_status not in ('machine-drafted', 'reviewed') or p_locale not in ('hi', 'mr', 'bn', 'ta', 'te')
     or p_title is null or char_length(btrim(p_title)) not between 1 and 400
     or char_length(coalesce(p_description, '')) > 8000 then
    raise exception 'BP_INVALID_INPUT' using errcode = 'P0001';
  end if;
  select * into cur from public.market_translations where market_id = p_market_id and locale = p_locale for update;
  existed := found;
  if existed and p_status = 'machine-drafted' and cur.status = 'reviewed' and cur.source_hash = hash then
    return false;
  end if;
  insert into public.market_translations (market_id, locale, title, description, source_hash, status)
  values (p_market_id, p_locale, btrim(p_title), coalesce(p_description, ''), hash, p_status)
  on conflict (market_id, locale) do update
     set title = excluded.title, description = excluded.description,
         source_hash = excluded.source_hash, status = excluded.status;
  perform public._audit(me.id, 'translation.save', 'market', p_market_id::text,
    case when existed then jsonb_build_object('locale', p_locale, 'title', cur.title, 'status', cur.status) end,
    jsonb_build_object('locale', p_locale, 'title', btrim(p_title), 'status', p_status));
  return true;
end;
$$;

create or replace function public.admin_save_outcome_translation(
  p_outcome_id uuid, p_locale text, p_label text, p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   public.profiles%rowtype := public._staff('moderator');
  src  text;
  mid  uuid;
  hash text;
  cur  public.outcome_translations%rowtype;
  existed boolean;
begin
  select label, market_id into src, mid from public.outcomes where id = p_outcome_id;
  if src is null then raise exception 'BP_NOT_FOUND' using errcode = 'P0001'; end if;
  if p_status not in ('machine-drafted', 'reviewed') or p_locale not in ('hi', 'mr', 'bn', 'ta', 'te')
     or p_label is null or char_length(btrim(p_label)) not between 1 and 200 then
    raise exception 'BP_INVALID_INPUT' using errcode = 'P0001';
  end if;
  hash := public.outcome_source_hash(src);
  select * into cur from public.outcome_translations where outcome_id = p_outcome_id and locale = p_locale for update;
  existed := found;
  if existed and p_status = 'machine-drafted' and cur.status = 'reviewed' and cur.source_hash = hash then
    return false;
  end if;
  insert into public.outcome_translations (outcome_id, locale, label, source_hash, status)
  values (p_outcome_id, p_locale, btrim(p_label), hash, p_status)
  on conflict (outcome_id, locale) do update
     set label = excluded.label, source_hash = excluded.source_hash, status = excluded.status;
  perform public._audit(me.id, 'translation.save_outcome', 'market', mid::text,
    case when existed then jsonb_build_object('locale', p_locale, 'outcome', src, 'label', cur.label) end,
    jsonb_build_object('locale', p_locale, 'outcome', src, 'label', btrim(p_label), 'status', p_status));
  return true;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.admin_take_translation_quota(uuid)',
                           'public.admin_save_market_translation(uuid,text,text,text,text)',
                           'public.admin_save_outcome_translation(uuid,text,text,text)'] loop
    execute format('revoke all on function %s from public, anon, service_role', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- The English source of a market for translation (drafts included), staff only.
create or replace function public.admin_translation_source(p_market_id uuid)
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
  select jsonb_build_object(
           'title', m.title, 'description', m.description, 'subcategory', m.subcategory,
           'outcomes', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label) order by o.sort_order)
                                   from public.outcomes o where o.market_id = m.id), '[]'::jsonb))
    into out
    from public.markets m where m.id = p_market_id;
  return out;
end;
$$;
revoke all on function public.admin_translation_source(uuid) from public, anon, service_role;
grant execute on function public.admin_translation_source(uuid) to authenticated;
