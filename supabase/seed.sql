-- =============================================================================
-- supabase/seed.sql — runs after migrations on `supabase db reset`.
-- Only configuration lives here. Markets are imported from src/data/markets.ts
-- by `npm run db:seed` (scripts/db-seed.ts), which is idempotent.
-- All amounts are virtual play credits.
-- =============================================================================
insert into public.app_settings (key, value) values
  ('trading_enabled', 'true'::jsonb),     -- global kill switch (Phase 4/8)
  ('min_trade',       '1'::jsonb),        -- credits; mirrors MIN_TRADE in trade-limits.ts
  ('max_trade',       '100000'::jsonb),   -- credits; mirrors MAX_TRADE in trade-limits.ts
  ('signup_credit',   '10000'::jsonb),    -- one-time grant on first sign-in (Phase 2)
  ('default_liquidity_b', '1000'::jsonb)  -- LMSR b for new markets (Phase 6 form default)
on conflict (key) do nothing;
