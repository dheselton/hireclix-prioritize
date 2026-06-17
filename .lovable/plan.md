## Add task delete

`deleteTask(id)` already exists in `src/lib/pm/api.ts` (deletes from `pm_tasks`). Just need to expose it in the UI.

### Edits

1. **`src/pages/pm/TaskWorkspace.tsx`** — In the header action row (next to Quick edit), add a destructive "Delete" button (Trash2 icon, `variant="ghost"`, red text).
   - On click: `confirm("Delete this task? This cannot be undone.")` → `await deleteTask(task.id)` → `emitTasksChanged()` → toast → `navigate` back to `/pm/projects/{task.project_id}`.

2. **`src/components/pm/TaskDrawer.tsx`** — Add a small "Delete task" link/button at the bottom of the Quick Edit drawer (below the existing content).
   - Same confirm + `deleteTask` + `emitTasksChanged()` + close drawer.

That's it — no schema, no new tables. Page-group deletion (already in TasksTab) stays untouched. Lists/boards refresh automatically via the existing `useTasksChanged(reload)` listener.

### Out of scope

- Per-card hover trash on the board/list (keeps cards uncluttered; user can open the task to delete). Can add later if requested.
- Soft-delete / undo. Current behavior is hard delete via the existing helper.
