## Problem

When a user is added/removed/promoted on a task from the workspace (or anywhere), the board/list cards on the project page don't reflect it until a refresh. Status changes from the workspace already work because the workspace emits a `tasks-changed` event that `ProjectDetail` listens to via `useTasksChanged(reload)`. The assignee mutation helpers don't emit that event, so the parent never re-fetches `pm_tasks` and the card avatars stay stale.

## Fix

Have every assignee mutation broadcast `emitTasksChanged()` so every subscriber (ProjectDetail, Briefing, Work Queue, etc.) re-fetches automatically — same mechanism the rest of the app already uses.

### Edits

1. **`src/lib/pm/assignees.ts`**
   - Import `emitTasksChanged` from `@/lib/pm/refresh`.
   - Call it at the end of `addAssignee`, `removeAssignee`, and `setPrimaryAssignee` (after the Supabase writes succeed).

2. **`src/components/pm/AssigneePopover.tsx`**
   - In the `single` mode branch (the direct `pm_tasks.update({ assignee_id })` path used when not in multi mode), call `emitTasksChanged()` right after the successful update, alongside the existing `onChanged?.()`.

That's it — no UI changes, no schema changes. The existing `useTasksChanged(reload)` hook in `ProjectDetail` (and the equivalent listeners in Briefing/Work) will pull the fresh `pm_tasks` row, so the primary-owner avatar on every card updates immediately. Co-assignee changes already invalidate the react-query map via `invalidate()`; the new emit covers the primary-owner case that was missing.

### Out of scope

- No realtime Postgres subscriptions — the project already standardizes on the in-tab `tasks-changed` CustomEvent. Adding Supabase realtime is a larger change and not required to solve the reported bug.
- Status-change propagation already works (kanban drag, ClaimButton via `updateTask`, workspace status changes all emit). No edits needed there.
