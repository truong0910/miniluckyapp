-- Migration 0017: Fix guest scope matching by checking campaign_participants registration_source
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
  v_allowed_spins integer;
  v_total_probability numeric := 0;
  v_cursor numeric := 0;
  v_rule_id uuid;
  v_reward_id text;
  v_reward_code text;
  v_outcome text;
  v_selected boolean := false;
  v_rule_applied boolean := false;
  v_campaign_id uuid;
  v_is_guest boolean := false;
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

  -- Resolve active campaign
  select id into v_campaign_id
  from public.campaigns
  where status = 'active'
  order by created_at desc
  limit 1;

  if v_campaign_id is null then
    v_campaign_id := '00000000-0000-0000-0000-000000000001'::uuid;
  end if;

  -- Read quota from active campaign.
  select spin_quota into v_allowed_spins
  from public.campaign_participants
  where campaign_id = v_campaign_id and customer_id = p_customer_id and status = 'active';

  if not found then
    if v_campaign_id = '00000000-0000-0000-0000-000000000001'::uuid then
      v_allowed_spins := v_customer.total_spins;
    else
      -- Check unlisted customer policy for current active campaign
      select unlisted_spin_quota into v_allowed_spins
      from public.campaigns
      where id = v_campaign_id and allow_unlisted = true;

      if not found then
        raise exception using errcode = 'P0003', message = 'customer is not a participant in the active campaign';
      end if;
      v_is_guest := true;
    end if;
  end if;

  -- Count spins scoped to current campaign
  select count(*)::integer into v_spin_count
  from public.spin_events
  where customer_id = p_customer_id and campaign_id = v_campaign_id;
  v_spin_number := v_spin_count + 1;

  if v_spin_number > v_allowed_spins then
    raise exception using errcode = 'P0001', message = 'no spins remaining';
  end if;

  select * into v_assignment
  from public.customer_rewards
  where customer_id = p_customer_id and campaign_id = v_campaign_id
  order by created_at asc, id asc
  offset v_spin_number - 1
  limit 1;

  for v_rule in
    select r.*
    from public.campaign_rules r
    where r.active
      and r.campaign_id = v_campaign_id
      and (r.starts_at is null or r.starts_at <= now())
      and (r.ends_at is null or r.ends_at >= now())
      and (
        r.scope = 'default'
        or (
          r.scope = 'guest' and (
            v_is_guest
            or exists (
              select 1 from public.campaign_participants cp
              where cp.campaign_id = v_campaign_id
                and cp.customer_id = p_customer_id
                and cp.registration_source in ('zalo_guest', 'unlisted')
            )
          )
        )
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
      case when r.scope = 'user' then 4 when r.scope = 'group' then 3 when r.scope = 'guest' then 2 else 1 end desc,
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
      where customer_id = p_customer_id and campaign_id = v_campaign_id and outcome = 'reward'
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
    insert into public.customer_rewards (campaign_id, customer_id, code, title, value, description, wheel_label, result)
    values (v_campaign_id, p_customer_id, v_reward_code, v_reward.title, v_reward.value, coalesce(v_reward.description, ''), v_reward.wheel_label, v_result)
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
    'spinsRemaining', greatest(0, v_allowed_spins - v_spin_number)
  );

  insert into public.spin_events (
    id, campaign_id, customer_id, rule_id, spin_number, outcome, reward_id, reward_code,
    metadata, idempotency_key, response, created_at
  ) values (
    v_event_id, v_campaign_id, p_customer_id, v_rule_id, v_spin_number, v_outcome, v_reward_id,
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
    ) values (
      v_campaign_id,
      v_event_id,
      p_customer_id,
      v_reward_id,
      v_reward_code,
      v_reward_json ->> 'title',
      (v_reward_json ->> 'value')::bigint,
      coalesce(v_reward_json ->> 'description', ''),
      v_result,
      'issued',
      v_created_at,
      v_created_at,
      v_created_at
    ) on conflict (spin_event_id) do nothing;

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
