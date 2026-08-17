# Implementation Plan — Customer Groups Management (Quản lý Nhóm khách hàng)

> **Goal:** Implement full Customer Groups management in Backend service, Admin API routes, and Admin Web UI according to `CUSTOMER_GROUPS_HANDOFF.md`.

---

## User Review Required

> [!IMPORTANT]
> - Group deletion ONLY removes group metadata and member/rule assignments (`customer_groups`, `customer_group_members`, `group_rule_assignments`). It NEVER deletes customer master records (`public.customers`), campaigns, spin events, or awards.
> - Excel import for voucher assignment retains `Ghi chú` as voucher denomination string (e.g. "5 triệu, 3 triệu") and will NOT convert `Ghi chú` into group names.

---

## Proposed Changes

### Backend Core Service

#### [NEW] [customer-group-service.js](file:///d:/thuctap/zalominiapp/backend/src/customer-group-service.js)
- `listGroups({ db, search })`: Returns customer groups list with `memberCount` and `ruleCount`.
- `createGroup({ db, name })`: Creates group, validating non-empty and unique name.
- `renameGroup({ db, id, name })`: Updates group name with non-empty and unique check.
- `deleteGroup({ db, id })`: Safely removes group assignments and group record without touching customer master data.
- `listGroupMembers({ db, groupId, page, limit, search })`: Paginated member lookup.
- `addGroupMember({ db, groupId, customerId })`: Idempotently links customer to group.
- `removeGroupMember({ db, groupId, customerId })`: Unlinks customer from group.
- `replaceGroupMembers({ db, groupId, customerIds })`: Bulk updates member list.
- `listGroupRules({ db, groupId, campaignId })`: Retrieves group rule assignments.
- `assignRuleToGroup({ db, groupId, ruleId })`: Links campaign rule to group.
- `replaceGroupRules({ db, groupId, ruleIds })`: Bulk replaces rule assignments for group.
- `removeRuleFromGroup({ db, groupId, ruleId })`: Unlinks rule from group.

#### [NEW] [customer-group-service.test.js](file:///d:/thuctap/zalominiapp/backend/test/customer-group-service.test.js)
- Unit tests for all customer group service methods.

---

### Backend Admin Routes

#### [MODIFY] [admin.routes.js](file:///d:/thuctap/zalominiapp/backend/src/routes/admin.routes.js)
- Expose authenticated admin routes:
  - `GET /api/v1/admin/groups`
  - `POST /api/v1/admin/groups`
  - `PUT /api/v1/admin/groups/:id`
  - `DELETE /api/v1/admin/groups/:id`
  - `GET /api/v1/admin/groups/:id/members`
  - `PUT /api/v1/admin/groups/:id/members`
  - `POST /api/v1/admin/groups/:id/members/:customerId`
  - `DELETE /api/v1/admin/groups/:id/members/:customerId`
  - `GET /api/v1/admin/groups/:id/rules`
  - `PUT /api/v1/admin/groups/:id/rules`
  - `POST /api/v1/admin/groups/:id/rules/:ruleId`
  - `DELETE /api/v1/admin/groups/:id/rules/:ruleId`

#### [NEW] [admin-groups.test.js](file:///d:/thuctap/zalominiapp/backend/test/admin-groups.test.js)
- Contract tests for customer group routes.

---

### Admin Web Frontend

#### [MODIFY] [App.jsx](file:///d:/thuctap/zalominiapp/admin-web/src/App.jsx)
- Add **Nhóm khách** navigation tab.
- Build Customer Groups dashboard UI:
  - Groups table (Name, Member count, Rule count, Actions).
  - Modal/Inline panel for creating & renaming groups.
  - Member management panel with customer search by Name/Phone to add/remove members.
  - Rule assignment panel with Campaign selector to assign rules to groups.

---

## Verification Plan

### Automated Tests
- Backend Unit Tests: `npm --prefix backend test`
- DB Integration Tests: `npm --prefix backend test:db`
- Mini App Tests: `npm --prefix lucky-wheels test -- --run`
- Production Build: `npm run build`

### Manual Verification
- Test creating a group "VIP", searching customer by name/phone, adding to group, assigning campaign rule, and verifying delete safety.
