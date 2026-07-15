## Expand the New Task dialog

Right now `NewTaskDialog` stops at Title / Description / Type / Priority / Assignees / Dates / Tags. Everything else (files, links, checklist, dependencies, watchers, estimate) requires creating the task, opening the workspace, and adding them there. This plan lets you capture all of that at creation.

### Layout

Keep the current top of the dialog exactly as-is (nothing moves), then add a single **"More options"** collapsible below Tags (default open the first time, remember state in `localStorage`) containing the new blocks. This keeps the dialog fast for quick-adds and thorough when you need it.

New blocks, in order:

1. **Attachments & links** — reuse `IntakeAttachmentsField` (drag/drop files + "Add link" with optional label). Same UX as the Quick Request form.
2. **Checklist** — inline "add item" list (Enter to add, ✕ to remove). Simple `{ label: string }[]` state.
3. **Blocked by** — reuse `TaskPicker` (already used in the workspace `DependenciesSection`) scoped to `project.id`, multi-select. Includes a small **Reveal mode** select (`on_complete` default / `on_start` / `always`) that applies to every dep added here.
4. **Watchers** — multi-picker (same `AssigneePopover controlled` pattern used for assignees) writing to `pm_task_watchers`.
5. **Estimated hours** — single numeric input feeding `estimated_hours`.

### Save pipeline (extends `handleSave`)

After `createTask(...)` returns, run in order (each guarded so an empty section is a no-op):

1. Co-assignees — unchanged.
2. `persistIntakeAttachments({ projectId, taskId: created.id, files, links, userId })` — existing helper handles bucket upload + `pm_attachments` + `pm_task_links`.
3. Checklist items → bulk insert into `pm_checklist_items` with incrementing `sort_order`.
4. Dependencies → bulk insert into `pm_task_dependencies` (`task_id = created.id`, `blocks_task_id = predecessorId`, `reveal_mode`).
5. Watchers → bulk insert into `pm_task_watchers`.
6. Toast + close + `onCreated?.()` as today.

### Files touched

- `src/components/pm/project/NewTaskDialog.tsx` — add state, "More options" collapsible, the five blocks, and the extended save pipeline.

### Out of scope

- No schema changes (all target tables + the `task-attachments` bucket exist).
- No changes to `TaskDrawer` Quick Edit, the workspace, `CreateWorkDialog`, or the public Quick Request form.
- Snippets, design rounds, dev status log, time entries, client environments, and comments stay workspace-only — they're workflow artifacts that belong after work starts.