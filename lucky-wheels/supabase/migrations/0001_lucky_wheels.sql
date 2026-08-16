create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'editor')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
  );
$$;

create table if not exists public.banners (
  id text primary key,
  title text not null,
  image_url text not null,
  link_url text,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_catalog (
  id text primary key,
  code_prefix text not null unique,
  title text not null,
  value bigint not null check (value > 0),
  description text not null default '',
  wheel_label text not null,
  symbol text not null check (symbol in ('cherry', 'lemon', 'bell', 'star', 'red_envelope')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id text primary key,
  phone text not null unique,
  name text not null,
  sex text not null default 'other',
  job text not null default 'other',
  total_spins integer not null default 0 check (total_spins >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_rewards (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references public.customers(id) on delete cascade,
  code text not null,
  title text not null,
  value bigint not null check (value > 0),
  description text not null default '',
  wheel_label text,
  result jsonb not null default '["star", "star", "star"]'::jsonb,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (customer_id, code)
);

create table if not exists public.campaign_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  scope text not null default 'default' check (scope in ('user', 'group', 'default')),
  priority integer not null default 0,
  active boolean not null default true,
  allow_unlisted boolean not null default false,
  oa_required boolean not null default false,
  allow_refollow boolean not null default true,
  max_total_wins integer,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rule_spin_configs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.campaign_rules(id) on delete cascade,
  spin_number integer not null check (spin_number > 0),
  spin_count integer not null default 1 check (spin_count > 0),
  win_rate numeric(7,4) not null default 0 check (win_rate >= 0 and win_rate <= 100),
  max_wins integer,
  special_conditions jsonb not null default '{}'::jsonb,
  unique (rule_id, spin_number)
);

create table if not exists public.rule_spin_rewards (
  id uuid primary key default gen_random_uuid(),
  spin_config_id uuid not null references public.rule_spin_configs(id) on delete cascade,
  reward_id text not null references public.reward_catalog(id) on delete restrict,
  probability numeric(7,4) not null default 0 check (probability >= 0 and probability <= 100),
  quantity integer not null default 0 check (quantity >= 0),
  remaining_quantity integer not null default 0 check (remaining_quantity >= 0),
  unique (spin_config_id, reward_id)
);

create table if not exists public.customer_rule_assignments (
  customer_id text not null references public.customers(id) on delete cascade,
  rule_id uuid not null references public.campaign_rules(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, rule_id)
);

create table if not exists public.customer_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_group_members (
  group_id uuid not null references public.customer_groups(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, customer_id)
);

create table if not exists public.group_rule_assignments (
  group_id uuid not null references public.customer_groups(id) on delete cascade,
  rule_id uuid not null references public.campaign_rules(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, rule_id)
);

create table if not exists public.program_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.spin_events (
  id uuid primary key default gen_random_uuid(),
  customer_id text references public.customers(id) on delete set null,
  rule_id uuid references public.campaign_rules(id) on delete set null,
  spin_number integer,
  outcome text not null check (outcome in ('reward', 'better_luck')),
  reward_id text references public.reward_catalog(id) on delete set null,
  reward_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists banners_active_order_idx on public.banners (active, display_order);
create index if not exists rewards_active_value_idx on public.reward_catalog (active, value);
create index if not exists customers_phone_idx on public.customers (phone);
create index if not exists spin_events_customer_idx on public.spin_events (customer_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists banners_set_updated_at on public.banners;
create trigger banners_set_updated_at before update on public.banners
for each row execute function public.set_updated_at();

drop trigger if exists rewards_set_updated_at on public.reward_catalog;
create trigger rewards_set_updated_at before update on public.reward_catalog
for each row execute function public.set_updated_at();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists rules_set_updated_at on public.campaign_rules;
create trigger rules_set_updated_at before update on public.campaign_rules
for each row execute function public.set_updated_at();

alter table public.admin_profiles enable row level security;
alter table public.banners enable row level security;
alter table public.reward_catalog enable row level security;
alter table public.customers enable row level security;
alter table public.customer_rewards enable row level security;
alter table public.campaign_rules enable row level security;
alter table public.rule_spin_configs enable row level security;
alter table public.rule_spin_rewards enable row level security;
alter table public.customer_rule_assignments enable row level security;
alter table public.customer_groups enable row level security;
alter table public.customer_group_members enable row level security;
alter table public.group_rule_assignments enable row level security;
alter table public.program_settings enable row level security;
alter table public.spin_events enable row level security;

create policy "public can read active banners"
on public.banners for select to anon, authenticated using (active or public.is_admin());
create policy "admins manage banners"
on public.banners for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public can read active rewards"
on public.reward_catalog for select to anon, authenticated using (active or public.is_admin());
create policy "admins manage rewards"
on public.reward_catalog for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins manage customers"
on public.customers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage customer rewards"
on public.customer_rewards for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public can read active rules"
on public.campaign_rules for select to anon, authenticated using (active or public.is_admin());
create policy "admins manage rules"
on public.campaign_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins manage rule spin configs"
on public.rule_spin_configs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage rule spin rewards"
on public.rule_spin_rewards for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage customer rule assignments"
on public.customer_rule_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage groups"
on public.customer_groups for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage group members"
on public.customer_group_members for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage group rule assignments"
on public.group_rule_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public can read settings"
on public.program_settings for select to anon, authenticated using (true);
create policy "admins manage settings"
on public.program_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read spin events"
on public.spin_events for select to authenticated using (public.is_admin());

insert into public.reward_catalog (id, code_prefix, title, value, description, wheel_label, symbol)
values
  ('reward-5m', 'VOUCHER_5M', 'Voucher mua hàng 5.000.000đ', 5000000, 'Voucher mua hàng trị giá 5.000.000đ', '5 TRIỆU', 'red_envelope'),
  ('reward-4m', 'VOUCHER_4M', 'Voucher mua hàng 4.000.000đ', 4000000, 'Voucher mua hàng trị giá 4.000.000đ', '4 TRIỆU', 'star'),
  ('reward-3m', 'VOUCHER_3M', 'Voucher mua hàng 3.000.000đ', 3000000, 'Voucher mua hàng trị giá 3.000.000đ', '3 TRIỆU', 'star'),
  ('reward-2m', 'VOUCHER_2M', 'Voucher mua hàng 2.000.000đ', 2000000, 'Voucher mua hàng trị giá 2.000.000đ', '2 TRIỆU', 'bell'),
  ('reward-100k', 'VOUCHER_100K', 'Voucher mua hàng 100.000đ', 100000, 'Voucher mua hàng trị giá 100.000đ', '100K', 'bell')
on conflict (id) do nothing;

-- Demo customers from the original Mini App are kept as migration seeds so a
-- fresh project can be tested immediately. Replace/import real customers in
-- Admin Web for production.
insert into public.customers (id, phone, name, sex, job, total_spins)
values
  ('KH001', '0934252139', 'CONG TY DAI TRUONG THANH', 'other', 'other', 5),
  ('KH002', '0900000002', 'TRAN THI B', 'female', 'other', 2),
  ('KH003', '0327925082', 'KHACH HANG 0327925082', 'other', 'other', 15)
on conflict (id) do nothing;

insert into public.customer_rewards (customer_id, code, title, value, description, result)
values
  ('KH001', 'DTT_VOUCHER_5M_01', 'Voucher 5.000.000d', 5000000, 'Voucher mua hang tri gia 5.000.000d', '["red_envelope","red_envelope","red_envelope"]'),
  ('KH001', 'DTT_VOUCHER_5M_02', 'Voucher 5.000.000d', 5000000, 'Voucher mua hang tri gia 5.000.000d', '["red_envelope","red_envelope","red_envelope"]'),
  ('KH001', 'DTT_VOUCHER_3M_03', 'Voucher 3.000.000d', 3000000, 'Voucher mua hang tri gia 3.000.000d', '["star","star","star"]'),
  ('KH002', 'VOUCHER_100K_01', 'Voucher 100.000d', 100000, 'Voucher mua hang tri gia 100.000d', '["bell","bell","bell"]'),
  ('KH003', 'KH003_VOUCHER_5M_01', 'Voucher 5.000.000d', 5000000, 'Voucher mua hang tri gia 5.000.000d', '["red_envelope","red_envelope","red_envelope"]'),
  ('KH003', 'KH003_VOUCHER_5M_02', 'Voucher 5.000.000d', 5000000, 'Voucher mua hang tri gia 5.000.000d', '["red_envelope","red_envelope","red_envelope"]'),
  ('KH003', 'KH003_VOUCHER_4M_03', 'Voucher 4.000.000d', 4000000, 'Voucher mua hang tri gia 4.000.000d', '["star","star","star"]'),
  ('KH003', 'KH003_VOUCHER_3M_04', 'Voucher 3.000.000d', 3000000, 'Voucher mua hang tri gia 3.000.000d', '["star","star","star"]'),
  ('KH003', 'KH003_VOUCHER_2M_05', 'Voucher 2.000.000d', 2000000, 'Voucher mua hang tri gia 2.000.000d', '["bell","bell","bell"]')
on conflict (customer_id, code) do nothing;

-- Banner images are uploaded by the Backend using the service role key.
-- The bucket is public so the Mini App can render the returned image URL.
insert into storage.buckets (id, name, public)
values ('campaign-assets', 'campaign-assets', true)
on conflict (id) do update set public = excluded.public;
