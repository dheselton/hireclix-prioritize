
# Fix Add Task on project Tasks tab

Two issues today on `/pm/projects/:id`:

1. **Header "Add task" button** (in `ProjectHeader`) just switches to the Tasks tab — it doesn't open any composer.
2. **The bottom "Quick add task…" input** in `ProjectDetail.tsx` only captures a title and hard-codes `type: "design"`, `priority: "medium"`, `assignee_id = current user`. No way to set type/team/priority/due date at creation time, and the default type is wrong for non-designers.

## Fix

### 1. New `NewTaskDialog` component
`src/components/pm/project/NewTaskDialog.tsx` — a small modal with:

- **Title** (required)
- **Type** (select, all `TASK_TYPES`) — defaults from the current user's role:
  - `designer → design`, `developer → dev`, `qa → qa`, `strategist → strategy`, `analyst → analytics`, `pm → review`, `csm/support → review`
  - Always editable, so a PM can switch a task to dev/design/etc.
- **Assignee** (re-use `AssigneePopover`) — defaults to current user; PM can reassign
- **Priority** (low/medium/high/urgent) — defaults `medium`
- **Due date** (optional, mm/dd/yyyy via existing `date-picker`)
- **Phase** (optional select if the project has phases)

On submit, calls `createTask({...})` with the chosen fields. `teams[]` is intentionally not set on the client — the existing DB trigger seeds `teams` from `type` via `DEFAULT_TEAMS_FOR_TYPE`. Reloads tasks, toasts success, closes.

### 2. Wire it up in `ProjectDetail.tsx`
- Add `const [newTaskOpen, setNewTaskOpen] = useState(false)`.
- `<ProjectHeader … onAddTask={() => { setTab("tasks"); setNewTaskOpen(true); }} />` — the header button now actually opens the dialog.
- Replace the bottom `Quick add task…` Input + Add button with a single `+ New task` button that opens the same dialog (keeps Tasks tab uncluttered; the dialog is the one canonical entry point).
- Remove the now-dead `quickAdd` state and `quickAddTask()` function.
- Mount `<NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} project={project} phases={phases ?? []} meId={user?.id ?? null} meRole={user?.role ?? null} onCreated={reload} />` once on the page.

### 3. Also expose `+ New task` inside `TasksTab` toolbar
Add a `+ New task` button next to the existing "Add page" / view toggle so creating a task is reachable from the tab itself (the header lives above and stays visible, but inline is faster). Optional callback `onAddTask?: () => void` prop on `TasksTab`; `ProjectDetail` passes `() => setNewTaskOpen(true)`.

### Validation
- Sign in as developer → click "Add task" in header → dialog opens, Type pre-selected `Dev`, Assignee = me.
- Switch role to designer → Type defaults to `Design`.
- Switch role to PM → Type defaults to `Review`; PM can pick any type from the dropdown.
- Save → task appears in the Tasks list under the correct status group with the right team color bar (because the DB trigger seeded `teams` from `type`).
- Bottom "Quick add" row is gone; replaced by a single `+ New task` button.

## Files touched
- **new**: `src/components/pm/project/NewTaskDialog.tsx`
- **edit**: `src/pages/pm/ProjectDetail.tsx` (remove inline quick-add, mount dialog, wire header button)
- **edit**: `src/components/pm/project/TasksTab.tsx` (optional `onAddTask` prop + toolbar button)

No DB/schema changes. No changes to `createTask` API.
