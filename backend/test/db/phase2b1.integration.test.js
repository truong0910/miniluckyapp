import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const migrationPath = path.resolve(
  process.cwd(),
  "../lucky-wheels/supabase/migrations/0004_awards_vouchers_foundation.sql",
);

test("phase 2B.1 migration declares awards and voucher snapshots", async () => {
  const sql = (await fs.readFile(migrationPath, "utf8")).toLowerCase();
  for (const declaration of [
    "create table if not exists public.awards",
    "campaign_id uuid not null references public.campaigns(id) on delete restrict",
    "spin_event_id uuid not null unique references public.spin_events(id) on delete cascade",
    "customer_id text not null references public.customers(id) on delete cascade",
    "reward_id text references public.reward_catalog(id) on delete set null",
    "status text not null default 'issued'",
    "status in ('issued', 'delivering', 'delivered', 'redeemed', 'expired', 'void')",
    "code text not null",
    "title_snapshot text not null",
    "value_snapshot bigint not null",
    "description_snapshot text not null",
    "result jsonb not null",
    "issued_at timestamptz not null default now()",
    "delivered_at timestamptz",
    "redeemed_at timestamptz",
    "expires_at timestamptz",
    "insert into public.awards",
    "left join public.customer_rewards cr on cr.customer_id = se.customer_id",
    "left join public.reward_catalog rc on rc.id = se.reward_id",
    "coalesce(cr.title, rc.title)",
    "coalesce(cr.value, rc.value)",
    "nullif(trim(coalesce(cr.title, rc.title)), '') is not null",
    "coalesce(cr.value, rc.value) > 0",
    "on conflict (spin_event_id) do nothing",
    "create index if not exists awards_customer_status_idx",
    "create index if not exists awards_campaign_status_idx",
    "set_updated_at",
    "alter table public.awards enable row level security",
    "create policy \"admins manage awards\"",
    "on public.awards for all to authenticated",
    "using (public.is_admin()) with check (public.is_admin())",
  ]) {
    assert.ok(sql.includes(declaration), `missing migration declaration: ${declaration}`);
  }
});

const testUrl = process.env.SUPABASE_TEST_URL;
const testKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

test(
  "awards backfill creates one issued snapshot for every resolvable historical reward spin event",
  {
    skip: !testUrl || !testKey
      ? "set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY for opt-in DB integration"
      : false,
  },
  async () => {
    const db = createClient(testUrl, testKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: awards, error: awardsError } = await db
      .from("awards")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    assert.ifError(awardsError);
    assert.ok(Array.isArray(awards));
    if (awards.length === 0) return;

    const cutoff = awards[0].created_at;
    const pageSize = 100;

    for (let pageStart = 0; ; pageStart += pageSize) {
      const { data: events, error: eventsError } = await db
        .from("spin_events")
        .select("id,campaign_id,customer_id,reward_id,reward_code")
        .eq("outcome", "reward")
        .not("customer_id", "is", null)
        .not("reward_code", "is", null)
        .lte("created_at", cutoff)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(pageStart, pageStart + pageSize - 1);
      assert.ifError(eventsError);

      for (const event of (events ?? []).filter((item) => item.reward_code.trim() !== "")) {
        const [{ data: customerReward, error: customerRewardError }, { data: catalogReward, error: catalogRewardError }] = await Promise.all([
          db
            .from("customer_rewards")
            .select("title,value")
            .eq("customer_id", event.customer_id)
            .eq("code", event.reward_code)
            .maybeSingle(),
          event.reward_id
            ? db.from("reward_catalog").select("title,value").eq("id", event.reward_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);
        assert.ifError(customerRewardError);
        assert.ifError(catalogRewardError);

        const title = customerReward?.title ?? catalogReward?.title;
        const value = customerReward?.value ?? catalogReward?.value;
        if (!title?.trim() || !value || value <= 0) continue;

        const { data: matchingAwards, error: matchingAwardsError } = await db
          .from("awards")
          .select("campaign_id,code,title_snapshot,value_snapshot,status")
          .eq("spin_event_id", event.id);
        assert.ifError(matchingAwardsError);
        assert.equal(matchingAwards?.length, 1, `expected one award for spin event ${event.id}`);

        const [award] = matchingAwards;
        assert.equal(award.campaign_id, event.campaign_id);
        assert.equal(award.code, event.reward_code);
        assert.equal(award.title_snapshot, title);
        assert.equal(award.value_snapshot, value);
        assert.equal(award.status, "issued");
      }

      if ((events ?? []).length < pageSize) break;
    }
  },
);
