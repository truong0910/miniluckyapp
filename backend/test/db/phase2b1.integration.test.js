import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

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
    "from public.customer_rewards",
    "from public.reward_catalog",
    "on conflict (spin_event_id) do nothing",
    "create index if not exists awards_customer_status_idx",
    "create index if not exists awards_campaign_status_idx",
    "set_updated_at",
    "alter table public.awards enable row level security",
    "create policy \"admins manage awards\"",
    "using (public.is_admin())",
    "with check (public.is_admin())",
  ]) {
    assert.ok(sql.includes(declaration), `missing migration declaration: ${declaration}`);
  }
});
