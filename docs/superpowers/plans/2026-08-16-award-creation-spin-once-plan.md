# Award Creation in Spin Once RPC (Phase 2B.4) Implementation Plan

> **Goal:** Automatically create an immutable `public.awards` record inside `spin_once` when a winning spin occurs.

## Global Constraints

- Migration must be named `lucky-wheels/supabase/migrations/0005_award_creation_spin_once.sql`.
- Must insert into `public.awards` with `on conflict (spin_event_id) do nothing`.
- Must preserve existing `spin_once` parameters, security definer settings, grant permissions, and return format.
- Run tests and commit each task.

---

## Task 1: Create Migration 0005 for Award Creation inside `spin_once`

**Files:**
- Create: `lucky-wheels/supabase/migrations/0005_award_creation_spin_once.sql`
- Create: `backend/test/db/phase2b4.integration.test.js`

**Step Checklist:**
- [ ] Create `0005_award_creation_spin_once.sql` updating `public.spin_once` with `insert into public.awards`.
- [ ] Create `backend/test/db/phase2b4.integration.test.js` asserting migration file declarations and opt-in DB test verifying award creation on winning spin.
- [ ] Run `npm --prefix backend test` and confirm contract tests pass.
- [ ] Commit as `feat: create awards automatically inside spin_once RPC`.

---

## Task 2: Verify and Push

**Step Checklist:**
- [ ] Run `npm --prefix backend test` and `npm --prefix lucky-wheels test -- --run`.
- [ ] Run `git status -sb` and `git diff --check`.
- [ ] Push to `origin/codex/participant-awards-api`.
