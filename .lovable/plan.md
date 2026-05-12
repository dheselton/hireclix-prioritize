## Goal
When a PM edits a task's start or due date (e.g. Discovery Call #1 → 3/31), every downstream task — Concept Round 1/2/3, Design rounds, GLAAT, Go Live, etc. — should automatically shift forward through the existing dependency graph + lag days. The PM sees a single "X tasks will move" confirmation and clicks Apply.

We already have all the pieces. We just need to wire them together.

## What exists today
- `recalculateForward(changedTaskId, {start, end}, tasks, deps)` in `src/lib/pm/scheduler.ts` — already does the cascade math (respects `finish_start`, `lag_days`, only pushes later, never pulls earlier).
- `CascadeConfirmModal` — already renders the diff list with a go-live warning.
- `ProjectDetail.tsx` — already uses the modal for go-live changes (`handleGoLiveChange` → `recalculateBackwardFromGoLive` → modal → `applyCascade`).
- `TaskDrawer.tsx` — currently calls `patch({ start_date })` / `patch({ due_date })` directly with no cascade.

## The simple wiring (one event + one handler)

### 1. Add a lightweight event in `src/lib/pm/refresh.ts`
Add `emitTaskDateProposed(payload)` / `useTaskDateProposed(handler)` mirroring the existing pub/sub. Payload: `{ taskId, start, end }`.

### 2. `TaskDrawer.tsx` — intercept date edits
Replace the two date `DatePicker.onChange` handlers so that instead of immediately `patch({ start_date })`:
- Compute the implied `{ start, end }` (using current `duration_days` to derive the missing side).
- Call `emitTaskDateProposed({ taskId, start, end })`.
- Do NOT write to DB yet — ProjectDetail will write everything atomically after confirmation.
- Optimistically update local `task` state so the picker reflects the chosen date until cascade resolves.

Other (non-date) fields keep working exactly as today.

### 3. `ProjectDetail.tsx` — handle the event with the existing modal
Add a `useTaskDateProposed` listener that:
- Runs `recalculateForward(taskId, {start, end}, tasks, deps)`.
- Sets `pendingDiffs` (existing state) and a new `pendingMode: 'forward' | 'backward'`.
- Opens `CascadeConfirmModal` (already mounted).

Generalize `applyCascade()` to handle both modes:
- forward mode: write all diffs (including the originally-changed task, which `recalculateForward` already includes), no `updateProject`.
- backward mode: existing go-live behavior.

Cancel = revert (just `reload()`), so the drawer's optimistic value is discarded.

### 4. Modal copy tweak
When `pendingMode === 'forward'`, title becomes "Cascade date change" and the warning still fires if anything pushes past `project.go_live_date`. No new component needed.

## Why this is the simplest viable approach
- Zero new schema, zero new business logic — `recalculateForward` already does exactly what the user described.
- One pub/sub event keeps `TaskDrawer` decoupled from `ProjectDetail`, mirroring the existing `emitTasksChanged` pattern.
- Single confirmation modal everywhere dates cascade (go-live OR task date), so PMs always get the same "here's what will move" preview before anything is written.
- Works automatically anywhere a date changes in the drawer; future entry points (inline Gantt drag, list-view edit) just emit the same event.

## Out of scope (intentionally)
- Inline Gantt drag-to-reschedule cascade — same event can be wired later.
- Auto-pulling tasks earlier when slack opens up — current `recalculateForward` only pushes later, which matches user expectation ("3/31 should push following things back").
- Business-day vs calendar-day math — unchanged.

## Files touched
- `src/lib/pm/refresh.ts` — add `emitTaskDateProposed` / `useTaskDateProposed`.
- `src/components/pm/TaskDrawer.tsx` — intercept start/due `onChange`, emit event instead of immediate patch.
- `src/pages/pm/ProjectDetail.tsx` — add listener, generalize `applyCascade`, add `pendingMode` state.
- `src/components/pm/CascadeConfirmModal.tsx` — minor: dynamic title based on mode (optional prop).
