## Role Separation — Plan

A lot of this is already in place (TypeFilterLabel replaces the old Track toggle, TopBar already has role pills, Board has per-role defaults + Customize popover, useTypeFilter exists with role defaults). The remaining work is gap-filling and a submitter pass.

### 1. TypeFilterLabel — make it invisible for "no-op" roles
Edit `src/components/pm/TypeFilterLabel.tsx`:
- When `types.size === 0` (PM / Submitter — all types), render **nothing** instead of "Showing: All task types".
- When a single role-default type is active, render the spec copy: `Showing design tasks · Show all types` (single concise sentence, no "+" join when default).
- Multi-type or user-overridden sets keep current "+ join" rendering with "Show all types" + "Reset" actions.

### 2. Role pill in TopBar
Already present and styled via `--role-*` HSL tokens. **No change.**

### 3. Work Queue — re-order and rename sections
Edit `src/pages/pm/WorkQueue.tsx` `sections` builder:
- **PM order:** Unclaimed Requests → My Active Projects & Tasks → Approvals Waiting on Me. Rename "My coordination tasks" → "My Active Projects & Tasks". Drop the standalone "Blocked across projects" section (blockers stay surfaced via the existing red alert card + chip). For "Approvals Waiting on Me", filter to tasks where `status='in_review'` AND the current PM user is a `pm_project_members` row with `role='PM'` on that project (one extra fetch of `pm_project_members where user_id=me and role='PM'`, intersect by `project_id`).
- **Designer order:** Unclaimed Design Requests → My Design Work → In Review — Needs My Attention. Tighten "Unclaimed" to `type='design'` only (drop `content`) per spec wording.
- **Developer order:** Unclaimed Dev Tasks → My Dev Tasks → Blocked — Needs Resolution. Tighten "Unclaimed" to `type='dev'` only.
- Strategist / Analyst paths untouched.

### 4. Board — defaults + Customize columns
Already implemented (DEFAULT_COLUMNS_BY_ROLE, localStorage key per role, Columns popover, Reset). **No change.**

### 5. Push type filter into the query layer
- Extend `fetchTasks` in `src/lib/pm/api.ts` with an optional `opts: { types?: TaskType[] }` arg → adds `.in('type', opts.types)` when set.
- Update callers that have a role-default filter active to pass `types` to `fetchTasks`:
  - `WorkQueue.tsx`, `Board.tsx`, `GlobalTimeline.tsx`, `Workload.tsx`.
- Refetch whenever the type-filter set changes (add `[...types].sort().join(",")` to the reload effect deps).
- Keep `applyTaskTypes` in memory as a safety net (no-op when DB already filtered).
- Project Detail Tasks tab and Project Detail Timeline tab are unaffected — they don't use `useTypeFilter`.

### 6. Submitter experience
- **WorkQueue:** when `role==='submitter'`, replace the multi-section layout with a single section **"Requests I've Submitted"** = tasks where `created_by = me`. Above it, render a banner card: `Submit a new request →` linking to `/f/{slug}` of the most recently created `pm_forms` row (query in `WorkQueue` for submitters only). Hide the StatCards row + red alerts banner for submitters (irrelevant).
- **Sidebar (`src/components/AppSidebar.tsx`):** filter `pmItems` for submitters to only `Work Queue`, `Projects`, `Forms`. Hide Board / Workload / Timeline / Templates / Integrations.
- **Forms page:** when `role==='submitter'`, render a read-only public-forms list (form name + Copy link / Open public link); hide the "New Form" button and the Edit links. Same `pm_forms` data, different render branch.
- **Projects (read-only for submitters):** add a check in `ProjectList` and `ProjectDetail` toolbars to hide create / edit actions when `role==='submitter'`. Detailed edit affordances inside ProjectDetail tabs that submitters shouldn't see (Configure Timeline, Add task, drag-reschedule) get gated behind the same flag. Light pass — no structural changes.
- **Route guards:** for hidden pages, add a redirect in `App.tsx` (or in each page) → if `role==='submitter'` and route is in the blocked set, `<Navigate to="/pm" replace />`. Prevents URL-based access.

### Files touched
- `src/components/pm/TypeFilterLabel.tsx`
- `src/pages/pm/WorkQueue.tsx`
- `src/lib/pm/api.ts` (+ all callers passing types)
- `src/pages/pm/Board.tsx`, `GlobalTimeline.tsx`, `Workload.tsx`
- `src/components/AppSidebar.tsx`
- `src/pages/pm/Forms.tsx`
- `src/pages/pm/ProjectList.tsx`, `src/pages/pm/ProjectDetail.tsx` (submitter read-only gating)
- `src/App.tsx` (submitter route guards)

### Open questions
1. **PM "Approvals Waiting on Me"** — spec says "the assigned PM on the project". I'll use `pm_project_members where user_id=me AND role='PM'`. If you'd rather treat any user with system-role `pm` as the implicit PM on every project (current behavior), say so and I'll skip the project-members join.
2. **Projects read-only for submitters** — should submitters even see `/pm/projects`? Spec lists "Projects (read-only)". Confirm they should browse all projects, not just ones tied to their own submissions.
