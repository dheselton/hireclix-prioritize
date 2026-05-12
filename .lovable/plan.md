# Plan: Hide empty buckets + universal View toggle with user default

## 1. Hide empty phase sections in Project Detail → Tasks

In `src/pages/pm/ProjectDetail.tsx` (`TaskTabContent`):

- After running `filterPhaseTasks(...)`, only render a `PhaseGroup` if the filtered list has at least one task.
- Applies to all phases plus the "No phase" bucket.
- When Me Mode (or any pill filter) yields zero results across **all** phases, show a single empty state card: "No tasks match the current filters" with a quick "Clear filters" link that resets the pill to default and exits Me Mode.
- The phase still appears with its current "Add task…" inline input ONLY when the user is viewing `All` with no Me Mode (i.e. authoring context). With an active filter (Me Mode on, or a non-default pill), empty phases are hidden entirely — no add row.

Result: in the screenshot, Designer + Me Mode would only show phases that contain at least one of Dan's design/content tasks.

## 2. Extend `useViewMode` to support `kanban`

In `src/hooks/useViewMode.ts`:

- Change `ViewMode` to `"list" | "grid" | "kanban"`.
- Update validation in the initial read and `storage` listener to accept all three.
- Add a second hook `useDefaultViewMode()` that reads/writes a single global preference at `pm.viewMode.default` used as the fallback when a specific `viewKey` has no stored value.
- `useViewMode(viewKey, fallback?)` resolution order: per-key stored value → global default → passed `fallback` → `"list"`.

## 3. ViewToggle already supports kanban

`src/components/pm/ViewToggle.tsx` already accepts a `modes` prop including `"kanban"`. No changes needed beyond passing `modes={["list","grid","kanban"]}` from callers that should expose all three.

## 4. Add View toggle to Project Detail → Tasks tab

In `ProjectDetail.tsx` Tasks tab header row (next to the View pills + "Showing my tasks" label):

- Add `<ViewToggle>` on the right with `viewKey="project.tasks"` and modes `list | kanban` (grid not meaningful for grouped phase tasks; kanban groups by status).
- **List mode** (default): current phase-grouped layout (with empty-phase hiding from step 1).
- **Kanban mode**: render a single board across all filtered tasks for the project, columns = task statuses (`unclaimed`, `in_progress`, `in_review`, `blocked`, `complete`/`approved`). Reuse the column rendering pattern from `src/pages/pm/Board.tsx` (extract a small `<TaskKanban tasks={...} onOpen={...} />` presentational component if Board's internals aren't directly reusable; otherwise import).
- Filtering (pill + Me Mode + empty-phase logic) is applied to the task list before it reaches either renderer.

## 5. Surface kanban option in other collections

Add `"kanban"` to the `modes` array everywhere a `ViewToggle` is rendered with task data:

- `src/pages/pm/WorkQueue.tsx`
- `src/pages/pm/Workload.tsx`
- `src/components/pm/CollectionToolbar.tsx` (when used for tasks)

Project-collection screens (`ProjectList.tsx`, `Forms.tsx`, `GlobalTimeline.tsx`) keep their current modes — kanban doesn't apply to projects/forms/timeline.

For each that gains kanban, render a `TaskKanban` (same component as Project Detail) when `mode === "kanban"`, fed by the already-filtered task list. No new data fetching.

## 6. User-chosen global default

In `src/components/TopBar.tsx` (or a small new `ViewDefaultMenu` rendered in TopBar near the role badge):

- Add a small dropdown labeled "Default view" with options List / Grid / Kanban.
- Persists via `useDefaultViewMode()` to `localStorage`.
- Acts as the fallback any time a screen hasn't had its per-screen toggle clicked yet. Per-screen toggles still override and are remembered per `viewKey`.
- Add a "Reset view preferences" link in the same menu that clears all `pm.viewMode.*` keys so every screen falls back to the global default again.

## Technical notes

- `ViewMode` type widening must be reflected in callers; TS will surface any miss.
- `Board.tsx` currently builds columns from `pm_tasks` for the whole workspace. For Project Detail kanban, scope its query/state to the project. Easiest: factor the column rendering (header + droppable list of `TaskCard`) into `src/components/pm/TaskKanban.tsx` taking `(tasks, onOpen, columns?)`. Leave drag-and-drop reordering as it currently exists in Board; in the project kanban, dropping into a column updates `task.status` via existing `updateTask`.
- Empty-state handling in step 1 should not regress the ability to add tasks. Provide a small "Add phase task" affordance from the empty state when no filter is active.
- No DB schema changes. No backend changes.
