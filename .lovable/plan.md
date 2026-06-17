## Goal
Make the "New task" dialog a complete composer so PMs/team members can set everything in one shot — multi-assignees, multi-type, and all the fields that currently force a "create → reopen → edit" round-trip.

## Changes (all in `src/components/pm/project/NewTaskDialog.tsx`)

### 1. Multi-assignees
Replace the single `AssigneePopover` with an inline chip list + add button (same pattern as `ControlPanel.AssigneeChips`):
- Local state: `assigneeIds: string[]` (order matters — first = primary).
- Chips show avatar + name + star on first (primary) + X to remove; click a non-primary chip to promote it.
- "+ Add" opens an `AssigneePopover` in `controlled` mode; `onPick` appends the id if not already present.
- On save:
  - `assignee_id = assigneeIds[0] ?? null`
  - After `createTask` returns the new row id, insert the remaining `assigneeIds.slice(1)` into `pm_task_assignees` via `addAssignee(taskId, uid)` (sequential await; small list).

### 2. Multi-type
Convert Type from a single `Select` to a multi-select popover (same chip pattern as `TeamsMultiSelect`):
- Local state: `types: TaskType[]` (first = primary, defaulted from role).
- Render selected as colored pills with X; "+ Add" popover lists remaining `TASK_TYPES`.
- Reordering: click a pill to promote to primary (matches assignee UX). Star icon on primary.
- On save:
  - `type = types[0]` (drives DB trigger that seeds `teams`).
  - Extra types persisted into `tags` as `type:dev`, `type:qa`, etc. (zero schema change, already searchable). Add a small helper inline; document in code comment.

### 3. Add remaining task fields
Expand dialog body (widen to `sm:max-w-[640px]`, scrollable) and add:
- **Description** — `Textarea`, 3 rows, optional.
- **Status** — `Select` of `TASK_STATUSES`. Default: `claimed` if any assignees else `unclaimed`. Auto-updates when assignees change unless user has manually touched it (track `statusDirty` flag).
- **Start date** — `DatePicker` (same Popover+Calendar pattern as Due date).
- **Duration (days)** — small numeric `Input`, default `1`, min `0.5` step `0.5`.
- **Teams** — `TeamsMultiSelect`. Default: union of `DEFAULT_TEAMS_FOR_TYPE[t]` for each selected type; recomputed whenever `types` changes unless user has manually edited (track `teamsDirty`).
- **Tags** — comma-separated `Input`, parsed to `string[]` on save (merged with the `type:*` tags above, deduped).
- **Dev environment** — `Input`, shown only when `types` includes `dev`.
- **Priority**, **Assignees**, **Due date**, **Phase** — already present, keep.

### Layout
```
Title (full row)
Description (full row)
─────────────────
Type [multi]        Priority
Status              Phase
Assignees [multi, full row]
Teams [multi, full row]
Start date          Due date
Duration            Tags
Dev environment (conditional, full row)
```

### Save flow
```ts
const primaryType = types[0];
const extraTypeTags = types.slice(1).map(t => `type:${t}`);
const allTags = Array.from(new Set([...userTags, ...extraTypeTags]));

const created = await createTask({
  project_id, phase_id: phaseId, title, description,
  type: primaryType,
  status,
  priority,
  assignee_id: assigneeIds[0] ?? null,
  start_date, due_date, duration_days,
  teams,                       // overrides DB trigger default
  tags: allTags,
  dev_environment: types.includes("dev") ? devEnv || null : null,
  sort_order: 9999,
});

for (const uid of assigneeIds.slice(1)) {
  await addAssignee(created.id, uid);
}
useInvalidateAssignees() equivalent → caller's onCreated() already reloads.
```

## Non-changes
- No schema/DB migration. Extra types ride in `tags`; multi-assignees use existing `pm_task_assignees`.
- No changes to `createTask`, ControlPanel, or `TasksTab` wiring — `onCreated` still triggers reload.
- TaskWorkspace already renders multi-assignees + teams; extra-type tags will appear in the tag list (acceptable; can be promoted to a first-class UI later if needed).

## Files touched
- **Edited**: `src/components/pm/project/NewTaskDialog.tsx` (only file).
