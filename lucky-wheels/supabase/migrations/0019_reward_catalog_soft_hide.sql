alter table public.reward_catalog
  add column if not exists hidden boolean not null default false;
