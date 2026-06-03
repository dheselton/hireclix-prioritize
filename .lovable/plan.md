## Goal

Let a task have more than one assignee, render that everywhere assignees appear today, and keep every existing single-assignee flow working unchanged.

## Approach: keep the primary owner, add co-assignees

`pm_tasks.assignee_id` already drives a lot of behavior — the claim flow, the `pm_set_task_track_from_assignee` DB trigger, the "my tasks" filters in Briefing / Workload / filters.ts, and the bulk reassign action. Replacing it would mean rewriting all of that and risk regressions.

Instead, treat `assignee_id` as the **primary owner** and add a join table `pm_task_assignees` for **additional people on the task**. The UI presents them as one combined list (primary first, co-assignees stacked after).

This is fully additive: every existing query, filter, trigger, and form keeps working. New behavior layers on top.

### Schema (migration)

```sql
CREATE TABLE public.pm_task_assignees (
  task_id     uuid NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.mock_users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX pm_task_assignees_user_idx ON public.pm_task_assignees(user_id);
-- GRANTs to authenticated/anon/service_role + permissive RLS (matches other pm_ tables while auth is off)
```

No trigger changes. No data migration — existing primaries stay where they are.

## UI changes (existing components, no new visual language)

### 1. New data layer — `src/lib/pm/assignees.ts`
- `useTaskAssigneesBulk(taskIds: string[]): Map<taskId, string[]>` — one batched query per list, react-query cached. Returns **co-assignees only** (primary already lives on the row).
- `useTaskAssignees(taskId)` for single-task views.
- `addAssignee(taskId, userId)`, `removeAssignee(taskId, userId)`, `setPrimary(taskId, userId)` (swaps a co-assignee into `assignee_id`, demotes the old primary into the join table).
- Emits a `task-assignees-changed` event so all consumers refetch.

### 2. `AssigneePopover` — add `mode: "single" | "multi"` (default `"single"`)
- Single mode: unchanged.
- Multi mode: shows checkmarks next to all current assignees (primary + co), click to add/remove. "Make primary" link on each selected non-primary row. "Assign me" shortcut at top.

### 3. New thin wrapper `MultiAssigneeChip`
- Props: `taskId`, `primaryId`, optional `coAssigneeIds` (so list views can pass pre-loaded data and skip the hook).
- Renders the existing `AvatarStack` (primary highlighted) when count > 1, otherwise the existing single `UserAvatar` button. Clicking opens `AssigneePopover` in multi mode. No new visual style — reuses what's already on the board.

### 4. Card surfaces that swap to `MultiAssigneeChip`
All currently render a single `UserAvatar`/`AssigneePopover`:
- `BoardTaskCard`, `ProjectTaskCard`, `RequestTaskCard`, `BlockedTaskCard`
- `TaskKanban`, `TaskListView`, `TaskGridView`
- `TasksTab`, `Board.tsx`
Each list view calls `useTaskAssigneesBulk(taskIds)` once and passes the slice down to the chip — no N+1 queries.

### 5. Task detail
- `ControlPanel` "Assignee" row becomes "Assignees": shows primary chip + each co-assignee chip (X to remove). `+` button opens the multi popover. Primary swap available via popover row action.
- `TaskWorkspace` header already shows primary via team stack — no change needed beyond the chip.

### 6. "Me" filters and queues
Update the predicate used by Briefing, Workload, and `src/lib/pm/filters.ts` so a task counts as "mine" when **either** `assignee_id === me` **or** `me ∈ coAssignees(task)`.
- `src/lib/pm/briefing.ts`: fetch `pm_task_assignees` rows where `user_id = me`, union with the primary-owner query.
- `src/pages/pm/Workload.tsx`: same union when computing per-user active tasks.
- `src/lib/pm/filters.ts`: accept an optional `coAssigneeIndex: Map<taskId, Set<userId>>` and use it in the existing `assignee_id === meId` checks.

### 7. Things that stay single-owner on purpose (preserves current behavior)
- Claim flow → still sets the primary owner.
- Track derivation trigger → still keyed off the primary.
- Status auto-unclaim when primary cleared → unchanged.
- Bulk "Assign to…" action → still sets primary (the most common ask); multi-add is per-task in the popover.

## Files touched

- **Migration**: create `pm_task_assignees` + GRANTs + RLS.
- **New**: `src/lib/pm/assignees.ts`, `src/components/pm/MultiAssigneeChip.tsx`.
- **Edited**: `src/components/pm/AssigneePopover.tsx` (add multi mode), `src/components/pm/workspace/ControlPanel.tsx`, `src/lib/pm/filters.ts`, `src/lib/pm/briefing.ts`, `src/pages/pm/Workload.tsx`, and the nine card/list components listed above.
- **Memory**: add a short note about the primary + co-assignee split and the bulk hook.

## Verification

After the migration: open a task workspace, add 2 co-assignees, verify they appear on the same task card on `/pm/board`, in `/pm/projects/:id` list and grid, in the workspace header chip, and that the co-assignees see the task in their `/pm` Briefing "my quick tasks" and Workload row. Confirm a single-assignee task still renders identically to today.