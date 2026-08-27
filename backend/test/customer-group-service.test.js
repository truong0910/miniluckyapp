import test from "node:test";
import assert from "node:assert/strict";
import {
  createGroup,
  renameGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
  assignRuleToGroup,
  removeRuleFromGroup,
  replaceGroupRules,
} from "../src/customer-group-service.js";

function createMockDb() {
  const groups = [];
  const members = [];
  const ruleAssignments = [];

  return {
    groups,
    members,
    ruleAssignments,
    from(table) {
      const filters = {};
      let action = null;
      let payload = null;

      const chain = {
        select() { return chain; },
        ilike() { return chain; },
        eq(col, val) {
          filters[col] = val;
          return chain;
        },
        or() { return chain; },
        order() { return chain; },
        range() { return chain; },
        insert(data) {
          action = "insert";
          payload = data;
          return chain;
        },
        update(data) {
          action = "update";
          payload = data;
          return chain;
        },
        delete() {
          action = "delete";
          return chain;
        },
        async single() {
          if (action === "insert" && table === "customer_groups") {
            const row = Array.isArray(payload) ? payload[0] : payload;
            const newGroup = { id: row.id || `group-${Date.now()}-${Math.random()}`, name: row.name, created_at: new Date().toISOString() };
            groups.push(newGroup);
            return { data: newGroup, error: null };
          }
          if (action === "update" && table === "customer_groups") {
            const group = groups.find((g) => g.id === filters.id);
            if (group) Object.assign(group, payload);
            return { data: group, error: null };
          }
          if (table === "customer_groups") {
            const found = groups.find((g) => (filters.id && g.id === filters.id) || (filters.name && g.name === filters.name));
            if (!found) return { data: null, error: { message: "Not found" } };
            return { data: found, error: null };
          }
          return { data: null, error: null };
        },
        async maybeSingle() {
          if (table === "customer_groups") {
            const found = groups.find((g) => (filters.id && g.id === filters.id) || (filters.name && g.name === filters.name));
            return { data: found || null, error: null };
          }
          return { data: null, error: null };
        },
        then(resolve) {
          if (table === "campaign_rules" && filters.campaign_id) {
            if (filters.campaign_id === "camp-A") {
              return resolve({ data: [{ id: "rule-A1" }, { id: "rule-A2" }], error: null });
            }
            if (filters.campaign_id === "camp-B") {
              return resolve({ data: [{ id: "rule-B1" }], error: null });
            }
            return resolve({ data: [], error: null });
          }
          if (action === "delete") {
            if (table === "customer_groups") {
              const idx = groups.findIndex((g) => g.id === filters.id);
              if (idx !== -1) groups.splice(idx, 1);
            }
            if (table === "customer_group_members") {
              const rem = members.filter((m) => {
                if (filters.group_id && filters.customer_id) {
                  return !(m.group_id === filters.group_id && m.customer_id === filters.customer_id);
                }
                if (filters.group_id) return m.group_id !== filters.group_id;
                if (filters.customer_id) return m.customer_id !== filters.customer_id;
                return true;
              });
              members.length = 0;
              members.push(...rem);
            }
            if (table === "group_rule_assignments") {
              const rem = ruleAssignments.filter((r) => {
                if (filters.group_id && filters.rule_id) {
                  return !(r.group_id === filters.group_id && r.rule_id === filters.rule_id);
                }
                if (filters.group_id) return r.group_id !== filters.group_id;
                if (filters.rule_id) return r.rule_id !== filters.rule_id;
                return true;
              });
              ruleAssignments.length = 0;
              ruleAssignments.push(...rem);
            }
            return resolve({ data: null, error: null });
          }
          if (action === "insert") {
            if (table === "customer_group_members") {
              const rows = Array.isArray(payload) ? payload : [payload];
              for (const row of rows) {
                if (!members.some((m) => m.group_id === row.group_id && m.customer_id === row.customer_id)) {
                  members.push({ ...row, created_at: new Date().toISOString() });
                }
              }
            }
            if (table === "group_rule_assignments") {
              const rows = Array.isArray(payload) ? payload : [payload];
              for (const row of rows) {
                if (!ruleAssignments.some((r) => r.group_id === row.group_id && r.rule_id === row.rule_id)) {
                  ruleAssignments.push({ ...row, created_at: new Date().toISOString() });
                }
              }
            }
            return resolve({ data: payload, error: null });
          }
          return resolve({ data: [], error: null });
        },
      };
      return chain;
    },
  };
}

test("createGroup validates non-empty and unique name", async () => {
  const db = createMockDb();

  await assert.rejects(
    async () => createGroup({ db, name: "" }),
    /Tên nhóm không được để trống/
  );

  const group1 = await createGroup({ db, name: "VIP" });
  assert.equal(group1.name, "VIP");

  await assert.rejects(
    async () => createGroup({ db, name: "VIP" }),
    /Tên nhóm 'VIP' đã tồn tại/
  );
});

test("renameGroup updates name and checks uniqueness", async () => {
  const db = createMockDb();
  const group1 = await createGroup({ db, name: "VIP" });
  const group2 = await createGroup({ db, name: "Đại lý" });

  await assert.rejects(
    async () => renameGroup({ db, id: group2.id, name: "VIP" }),
    /Tên nhóm 'VIP' đã tồn tại/
  );

  const updated = await renameGroup({ db, id: group1.id, name: "Super VIP" });
  assert.equal(updated.name, "Super VIP");
});

test("addGroupMember and removeGroupMember work idempotently", async () => {
  const db = createMockDb();
  const group = await createGroup({ db, name: "VIP" });

  await addGroupMember({ db, groupId: group.id, customerId: "cust-1" });
  await addGroupMember({ db, groupId: group.id, customerId: "cust-1" });
  assert.equal(db.members.length, 1);

  await removeGroupMember({ db, groupId: group.id, customerId: "cust-1" });
  assert.equal(db.members.length, 0);
});

test("assignRuleToGroup and removeRuleFromGroup manage rule links", async () => {
  const db = createMockDb();
  const group = await createGroup({ db, name: "VIP" });

  await assignRuleToGroup({ db, groupId: group.id, ruleId: "rule-1" });
  await assignRuleToGroup({ db, groupId: group.id, ruleId: "rule-1" });
  assert.equal(db.ruleAssignments.length, 1);

  await removeRuleFromGroup({ db, groupId: group.id, ruleId: "rule-1" });
  assert.equal(db.ruleAssignments.length, 0);
});

test("deleteGroup removes metadata links without affecting customers", async () => {
  const db = createMockDb();
  const group = await createGroup({ db, name: "VIP" });
  await addGroupMember({ db, groupId: group.id, customerId: "cust-1" });
  await assignRuleToGroup({ db, groupId: group.id, ruleId: "rule-1" });

  await deleteGroup({ db, id: group.id });
  assert.equal(db.groups.length, 0);
  assert.equal(db.members.length, 0);
  assert.equal(db.ruleAssignments.length, 0);
});

test("replaceGroupRules preserves rules of other campaigns when campaignId is supplied", async () => {
  const db = createMockDb();
  const group = await createGroup({ db, name: "VIP" });

  // Assign rules from camp-A and camp-B
  await assignRuleToGroup({ db, groupId: group.id, ruleId: "rule-A1" });
  await assignRuleToGroup({ db, groupId: group.id, ruleId: "rule-B1" });
  assert.equal(db.ruleAssignments.length, 2);

  // Replace rules for camp-A only with rule-A2
  await replaceGroupRules({ db, groupId: group.id, ruleIds: ["rule-A2"], campaignId: "camp-A" });

  const assignedRuleIds = db.ruleAssignments.map((r) => r.rule_id);
  assert.ok(assignedRuleIds.includes("rule-B1"), "Rule B1 from camp-B must be preserved");
  assert.ok(assignedRuleIds.includes("rule-A2"), "Rule A2 must be assigned");
  assert.ok(!assignedRuleIds.includes("rule-A1"), "Rule A1 from camp-A must be removed");
});
