-- Phase 2B.1: preserve a durable award snapshot for each reward spin.
-- This is additive: spin processing and delivery continue to use their existing tables.

create table if not exists public.awards (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  spin_event_id uuid not null unique references public.spin_events(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  reward_id text references public.reward_catalog(id) on delete set null,
  code text not null,
  title_snapshot text not null,
  value_snapshot bigint not null check (value_snapshot > 0),
  description_snapshot text not null default '',
  result jsonb not null default '["star", "star", "star"]'::jsonb,
  status text not null default 'issued'
    check (status in ('issued', 'delivering', 'delivered', 'redeemed', 'expired', 'void')),
  issued_at timestamptz not null default now(),
  delivered_at timestamptz,
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prefer the originally assigned customer reward because it captures the
-- historical code-specific values. Fall back to the catalog for rule rewards.
insert into public.awards (
  campaign_id,
  spin_event_id,
  customer_id,
  reward_id,
  code,
  title_snapshot,
  value_snapshot,
  description_snapshot,
  result,
  status,
  issued_at,
  created_at,
  updated_at
)
select
  se.campaign_id,
  se.id,
  se.customer_id,
  se.reward_id,
  se.reward_code,
  coalesce(cr.title, rc.title),
  coalesce(cr.value, rc.value),
  coalesce(cr.description, rc.description, ''),
  coalesce(
    cr.result,
    case
      when rc.symbol is not null then jsonb_build_array(rc.symbol, rc.symbol, rc.symbol)
      else '["star", "star", "star"]'::jsonb
    end
  ),
  'issued',
  se.created_at,
  se.created_at,
  se.created_at
from public.spin_events se
left join public.customer_rewards cr on cr.customer_id = se.customer_id
  and cr.code = se.reward_code
left join public.reward_catalog rc on rc.id = se.reward_id
where se.outcome = 'reward'
  and se.customer_id is not null
  and nullif(trim(se.reward_code), '') is not null
  and nullif(trim(coalesce(cr.title, rc.title)), '') is not null
  and coalesce(cr.value, rc.value) > 0
on conflict (spin_event_id) do nothing;

create index if not exists awards_customer_status_idx
  on public.awards (customer_id, status, created_at desc);
create index if not exists awards_campaign_status_idx
  on public.awards (campaign_id, status, created_at desc);

drop trigger if exists awards_set_updated_at on public.awards;
create trigger awards_set_updated_at before update on public.awards
for each row execute function public.set_updated_at();

alter table public.awards enable row level security;

-- No anon/authenticated read policy is created: award data is management-only.
drop policy if exists "admins manage awards" on public.awards;
create policy "admins manage awards"
on public.awards for all to authenticated
using (public.is_admin()) with check (public.is_admin());
