-- Phase 1: participant sessions, an idempotent transactional spin, and a
-- durable delivery outbox. This migration is additive and keeps all existing
-- customer, reward, rule, and spin data intact.

create table if not exists public.participant_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references public.customers(id) on delete cascade,
  token_hash text not null unique,
  auth_method text not null check (auth_method in ('preview', 'zalo')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists participant_sessions_customer_idx
  on public.participant_sessions (customer_id, expires_at desc);
create index if not exists participant_sessions_token_hash_idx
  on public.participant_sessions (token_hash);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  spin_event_id uuid not null references public.spin_events(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  channel text not null check (channel in ('zbs', 'oa')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  provider_message_id text,
  last_error text,
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (spin_event_id, channel)
);

create index if not exists deliveries_pending_idx
  on public.deliveries (status, next_attempt_at, created_at);

alter table public.spin_events add column if not exists idempotency_key text;
alter table public.spin_events add column if not exists response jsonb;
create unique index if not exists spin_events_customer_idempotency_idx
  on public.spin_events (customer_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists spin_events_customer_number_idx
  on public.spin_events (customer_id, spin_number);

alter table public.participant_sessions enable row level security;
alter table public.deliveries enable row level security;

-- The backend uses the service role for this function. No browser role can
-- call it directly, so customer identity and the idempotency key cannot be
-- supplied by an untrusted Mini App request.
create or replace function public.spin_once(
  p_customer_id text,
  p_idempotency_key text,
  p_oa_followed boolean default false,
  p_source text default 'participant'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_assignment public.customer_rewards%rowtype;
  v_rule public.campaign_rules%rowtype;
  v_spin_config public.rule_spin_configs%rowtype;
  v_reward_config public.rule_spin_rewards%rowtype;
  v_reward public.reward_catalog%rowtype;
  v_existing_response jsonb;
  v_response jsonb;
  v_reward_json jsonb;
  v_metadata jsonb;
  v_result jsonb;
  v_event_id uuid;
  v_created_at timestamptz;
  v_spin_number integer;
  v_spin_count integer;
  v_total_probability numeric := 0;
  v_cursor numeric := 0;
  v_rule_id uuid;
  v_reward_id text;
  v_reward_code text;
  v_outcome text;
  v_selected boolean := false;
  v_rule_applied boolean := false;
begin
  if nullif(trim(p_customer_id), '') is null then
    raise exception using errcode = '22023', message = 'customer_id is required';
  end if;
  if nullif(trim(p_idempotency_key), '') is null or length(p_idempotency_key) > 200 then
    raise exception using errcode = '22023', message = 'a valid idempotency key is required';
  end if;

  select * into v_customer
  from public.customers
  where id = p_customer_id and deleted_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'customer is not available';
  end if;

  select response into v_existing_response
  from public.spin_events
  where customer_id = p_customer_id and idempotency_key = p_idempotency_key
  limit 1;
  if found and v_existing_response is not null then
    return v_existing_response;
  end if;

  select count(*)::integer into v_spin_count
  from public.spin_events
  where customer_id = p_customer_id;
  v_spin_number := v_spin_count + 1;
  if v_spin_number > v_customer.total_spins then
    raise exception using errcode = 'P0001', message = 'no spins remaining';
  end if;

  select * into v_assignment
  from public.customer_rewards
  where customer_id = p_customer_id
  order by created_at asc, id asc
  offset v_spin_number - 1
  limit 1;

  -- Pick the highest-priority applicable rule. The customer row lock above
  -- serializes spin number and per-customer win-limit checks.
  for v_rule in
    select r.*
    from public.campaign_rules r
    where r.active
      and (r.starts_at is null or r.starts_at <= now())
      and (r.ends_at is null or r.ends_at >= now())
      and (
        r.scope = 'default'
        or exists (
          select 1 from public.customer_rule_assignments cra
          where cra.customer_id = p_customer_id and cra.rule_id = r.id
        )
        or exists (
          select 1
          from public.customer_group_members cgm
          join public.group_rule_assignments gra on gra.group_id = cgm.group_id
          where cgm.customer_id = p_customer_id and gra.rule_id = r.id
        )
      )
    order by r.priority desc,
      case when r.scope = 'user' then 3 when r.scope = 'group' then 2 else 1 end desc,
      r.created_at asc
  loop
    if v_rule.oa_required and not coalesce(p_oa_followed, false) then
      continue;
    end if;

    select * into v_spin_config
    from public.rule_spin_configs
    where rule_id = v_rule.id and spin_number = v_spin_number
    limit 1;
    if not found then
      continue;
    end if;
    v_rule_applied := true;
    v_rule_id := v_rule.id;

    if v_rule.max_total_wins is not null and (
      select count(*) from public.spin_events
      where customer_id = p_customer_id and outcome = 'reward'
    ) >= v_rule.max_total_wins then
      v_outcome := 'better_luck';
      exit;
    end if;
    if v_spin_config.max_wins is not null and (
      select count(*) from public.spin_events
      where customer_id = p_customer_id and rule_id = v_rule.id and outcome = 'reward'
    ) >= v_spin_config.max_wins then
      v_outcome := 'better_luck';
      exit;
    end if;
    if random() * 100 >= v_spin_config.win_rate then
      v_outcome := 'better_luck';
      exit;
    end if;

    select coalesce(sum(greatest(rs.probability, 0)), 0)
      into v_total_probability
    from public.rule_spin_rewards rs
    join public.reward_catalog rc on rc.id = rs.reward_id and rc.active
    where rs.spin_config_id = v_spin_config.id and rs.remaining_quantity > 0;
    if v_total_probability <= 0 then
      v_outcome := 'better_luck';
      exit;
    end if;

    v_cursor := random() * v_total_probability;
    for v_reward_config in
      select rs.*
      from public.rule_spin_rewards rs
      join public.reward_catalog rc on rc.id = rs.reward_id and rc.active
      where rs.spin_config_id = v_spin_config.id and rs.remaining_quantity > 0
      order by rs.id
      for update of rs
    loop
      v_cursor := v_cursor - greatest(v_reward_config.probability, 0);
      if v_cursor <= 0 then
        v_selected := true;
        exit;
      end if;
    end loop;
    if not v_selected then
      v_outcome := 'better_luck';
      exit;
    end if;

    update public.rule_spin_rewards
    set remaining_quantity = remaining_quantity - 1
    where id = v_reward_config.id and remaining_quantity > 0;
    if not found then
      v_outcome := 'better_luck';
      exit;
    end if;
    select * into v_reward from public.reward_catalog where id = v_reward_config.reward_id and active;
    if not found then
      v_outcome := 'better_luck';
      exit;
    end if;
    v_reward_id := v_reward.id;
    v_reward_code := format('RULE_%s_%s_%s_%s', v_reward.code_prefix, v_customer.phone, v_spin_number, replace(gen_random_uuid()::text, '-', ''));
    v_outcome := 'reward';
    exit;
  end loop;

  if not v_rule_applied then
    if v_assignment.id is not null then
      v_outcome := 'reward';
      v_reward_code := v_assignment.code;
      select * into v_reward
      from public.reward_catalog
      where value = v_assignment.value and active
      order by value desc
      limit 1;
      v_reward_json := jsonb_build_object(
        'code', v_assignment.code,
        'title', v_assignment.title,
        'value', v_assignment.value,
        'description', v_assignment.description,
        'wheelLabel', coalesce(v_assignment.wheel_label, v_assignment.title)
      );
      v_result := coalesce(v_assignment.result, '["star", "star", "star"]'::jsonb);
    else
      v_outcome := 'better_luck';
    end if;
  elsif v_outcome = 'reward' then
    v_reward_json := jsonb_build_object(
      'code', v_reward_code,
      'title', v_reward.title,
      'value', v_reward.value,
      'description', v_reward.description,
      'wheelLabel', v_reward.wheel_label,
      'symbol', v_reward.symbol
    );
    v_result := jsonb_build_array(v_reward.symbol, v_reward.symbol, v_reward.symbol);
    insert into public.customer_rewards (customer_id, code, title, value, description, wheel_label, result)
    values (p_customer_id, v_reward_code, v_reward.title, v_reward.value, coalesce(v_reward.description, ''), v_reward.wheel_label, v_result)
    on conflict (customer_id, code) do nothing;
  end if;

  if v_outcome = 'better_luck' then
    v_result := '["cherry", "lemon", "bell"]'::jsonb;
  end if;
  v_created_at := now();
  v_event_id := gen_random_uuid();
  v_metadata := jsonb_strip_nulls(jsonb_build_object(
    'source', coalesce(nullif(trim(p_source), ''), 'participant'),
    'phone', v_customer.phone,
    'ruleId', v_rule_id
  ));
  v_response := jsonb_build_object(
    'spinId', v_event_id,
    'timestamp', v_created_at,
    'outcome', v_outcome,
    'wheelSegmentId', case when v_reward_json is not null then format('reward-value-%s', coalesce((v_reward_json ->> 'value')::bigint, 0)) else 'better-luck' end,
    'result', v_result,
    'reward', v_reward_json,
    'spinsRemaining', greatest(0, v_customer.total_spins - v_spin_number)
  );

  insert into public.spin_events (
    id, customer_id, rule_id, spin_number, outcome, reward_id, reward_code,
    metadata, idempotency_key, response, created_at
  ) values (
    v_event_id, p_customer_id, v_rule_id, v_spin_number, v_outcome, v_reward_id,
    v_reward_code, v_metadata, p_idempotency_key, v_response, v_created_at
  ) on conflict do nothing;

  if not found then
    select response into v_existing_response
    from public.spin_events
    where customer_id = p_customer_id and idempotency_key = p_idempotency_key
    limit 1;
    return v_existing_response;
  end if;

  if v_reward_json is not null then
    insert into public.deliveries (spin_event_id, customer_id, channel, payload)
    values (
      v_event_id,
      p_customer_id,
      'zbs',
      jsonb_build_object('phone', v_customer.phone, 'customerName', v_customer.name, 'reward', v_reward_json)
    ) on conflict (spin_event_id, channel) do nothing;
  end if;

  return v_response;
end;
$$;

revoke all on function public.spin_once(text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.spin_once(text, text, boolean, text) to service_role;
