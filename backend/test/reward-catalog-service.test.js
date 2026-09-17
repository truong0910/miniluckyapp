import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { listRewards, setRewardHidden } from "../src/reward-service.js";

function createFakeDb(initialRows) {
  const state = {
    rows: initialRows.map((row) => ({ ...row })),
    filters: [],
    updates: [],
    deletes: 0,
  };

  return {
    state,
    from(table) {
      assert.equal(table, "reward_catalog");
      const query = {
        conditions: [],
        updateValues: null,
        sort: null,
        select() { return query; },
        order(column, { ascending = true } = {}) {
          query.sort = { column, ascending };
          return query;
        },
        eq(column, value) {
          query.conditions.push([column, value]);
          state.filters.push([column, value]);
          return query;
        },
        update(values) {
          query.updateValues = values;
          state.updates.push(values);
          return query;
        },
        single() {
          const id = query.conditions.find(([column]) => column === "id")?.[1];
          const row = state.rows.find((item) => item.id === id);
          if (row && query.updateValues) Object.assign(row, query.updateValues);
          return Promise.resolve({ data: row ? { ...row } : null, error: null });
        },
        then(resolve, reject) {
          const data = state.rows
            .filter((row) => query.conditions.every(([column, value]) => row[column] === value))
            .map((row) => ({ ...row }));
          if (query.sort) {
            const { column, ascending } = query.sort;
            data.sort((left, right) => (Number(left[column]) - Number(right[column])) * (ascending ? 1 : -1));
          }
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    delete() { state.deletes += 1; throw new Error("Permanent deletion is not allowed"); },
  };
}

const rewards = [
  { id: "reward-visible", code_prefix: "VIS", title: "Quà hiện", value: 100, hidden: false },
  { id: "reward-hidden", code_prefix: "HID", title: "Quà ẩn", value: 200, hidden: true },
];

test("reward catalog hides archived rewards by default and can include them for recovery", async () => {
  const db = createFakeDb(rewards);

  const visibleRewards = await listRewards({ db });
  const allRewards = await listRewards({ db, includeHidden: true });

  assert.deepEqual(visibleRewards.map((reward) => reward.id), ["reward-visible"]);
  assert.deepEqual(allRewards.map((reward) => reward.id), ["reward-hidden", "reward-visible"]);
  assert.deepEqual(db.state.filters, [["hidden", false]]);
  assert.equal(allRewards.find((reward) => reward.id === "reward-hidden").hidden, true);
});

test("hiding a reward changes only its hidden flag and preserves the record", async () => {
  const db = createFakeDb(rewards);

  const hiddenReward = await setRewardHidden({ db, id: "reward-visible", hidden: true });

  assert.equal(hiddenReward.hidden, true);
  assert.equal(db.state.rows.find((reward) => reward.id === "reward-visible").title, "Quà hiện");
  assert.deepEqual(db.state.updates, [{ hidden: true }]);
  assert.equal(db.state.deletes, 0);
});

test("reward hiding migration is additive and defaults existing rewards to visible", async () => {
  const migrationPath = path.resolve(process.cwd(), "../lucky-wheels/supabase/migrations/0019_reward_catalog_soft_hide.sql");
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /alter table public\.reward_catalog/i);
  assert.match(sql, /add column if not exists hidden boolean not null default false/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
});

test("admin reward routes filter hidden rewards and make legacy DELETE reversible", async () => {
  const routesPath = new URL("../src/routes/admin.routes.js", import.meta.url);
  const source = await readFile(routesPath, "utf8");
  const deleteStart = source.indexOf('router.delete("/rewards/:id"');
  const deleteEnd = source.indexOf("\n}));", deleteStart);
  const deleteRoute = source.slice(deleteStart, deleteEnd + 5);

  assert.match(source, /includeHidden:\s*req\.query\.includeHidden\s*===\s*"true"/);
  assert.match(source, /router\.patch\("\/rewards\/:id\/visibility"/);
  assert.match(deleteRoute, /setRewardHidden\(\{\s*db:\s*supabase,\s*id:\s*req\.params\.id,\s*hidden:\s*true/);
  assert.doesNotMatch(deleteRoute, /\.delete\(\)/);
});
