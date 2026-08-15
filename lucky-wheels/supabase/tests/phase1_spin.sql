-- Run this file only against an isolated Supabase test project after applying
-- 0001_lucky_wheels.sql and 0002_phase1_production_safety.sql.
-- It intentionally uses no production credentials and never deletes data.

begin;

do $$
begin
  if to_regclass('public.participant_sessions') is null then
    raise exception 'participant_sessions is missing';
  end if;
  if to_regclass('public.deliveries') is null then
    raise exception 'deliveries is missing';
  end if;
  if to_regclass('public.spin_events') is null then
    raise exception 'spin_events is missing';
  end if;
  if not exists (select 1 from pg_proc where proname = 'spin_once') then
    raise exception 'spin_once is missing';
  end if;
  if not exists (select 1 from pg_proc where proname = 'claim_deliveries') then
    raise exception 'claim_deliveries is missing';
  end if;
  if not exists (select 1 from pg_proc where proname = 'finish_delivery') then
    raise exception 'finish_delivery is missing';
  end if;
end;
$$;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'spin_events'
  and column_name in ('idempotency_key', 'response');

select indexname
from pg_indexes
where schemaname = 'public'
  and indexname = 'spin_events_customer_idempotency_idx';

rollback;
