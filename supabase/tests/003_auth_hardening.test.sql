-- pgTAP: sign-in rate limiter and owner settings (backend Phase B2).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

select is(hit_rate_limit('otp_send_ip', repeat('a', 64), 2, 600), true, '1st hit within a limit of 2');
select is(hit_rate_limit('otp_send_ip', repeat('a', 64), 2, 600), true, '2nd hit within a limit of 2');
select is(hit_rate_limit('otp_send_ip', repeat('a', 64), 2, 600), false, '3rd hit is over the limit');
select is(hit_rate_limit('otp_send_ip', repeat('b', 64), 2, 600), true, 'a different key has its own window');
select is(hit_rate_limit('otp_send_email', repeat('a', 64), 2, 600), true, 'a different bucket has its own window');
select throws_ok($$select hit_rate_limit('otp_send_ip', 'not-a-hash', 2, 600)$$, '23514', null,
  'keys must be SHA-256 hex (no raw IPs or emails)');
select throws_ok($$select hit_rate_limit('otp_send_ip', repeat('a', 64), 0, 600)$$, '22023', null,
  'a zero limit is refused');

select ok(not has_function_privilege('anon', 'public.hit_rate_limit(text,text,integer,integer)', 'execute'),
  'anon cannot call the limiter');
select ok(not has_function_privilege('authenticated', 'public.hit_rate_limit(text,text,integer,integer)', 'execute'),
  'signed-in users cannot call the limiter');
select ok(not has_table_privilege('authenticated', 'public.rate_limits', 'select'),
  'rate_limits is not readable by clients');

select is((select value from app_settings where key = 'default_liquidity_b'), '20000'::jsonb,
  'default liquidity b is 20,000 (owner decision)');
select is((select column_default from information_schema.columns
            where table_schema = 'public' and table_name = 'markets' and column_name = 'liquidity_b'),
  '20000', 'new markets default to b = 20,000');

select * from finish();
rollback;
