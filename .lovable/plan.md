# Fix project Tasks initial view + Board drag-and-drop

Two bugs on `/pm/projects/:id` → Tasks tab.

## Problem 1 — Tasks tab looks empty on first load

`TasksTab` defaults `showUpcoming = false`. `computeHiddenTaskIds()` marks any task whose predecessor isn't `complete/approved` as hidden. For a freshly created project (Brightspring Career Site), every task has an unmet predecessor → all 46 are hidden → the list/board is blank, forcing the user to click "+46 upcoming" before they see anything.

### Fix
In `src/components/pm/project/TasksTab.tsx`:

- Change the `showUpcoming` localStorage default so it falls back to **`true`** when nothing is stored (`localStorage.getItem(...) !== "0"`). New projects start fully visible; users who explicitly hit "Hide N upcoming" still have their choice remembered per project.
- Add a safety net: if hiding upcoming would leave `filtered.length === 0` AND there are tasks in the project, transparently show all of them (still display the toggle so power users can opt back in). This prevents the blank-state from ever returning even on edge-case data.
- Slight copy tweak on the toggle: when expanded it reads "Hide upcoming (N)" instead of just "Hide N upcoming" so the action is clearer.

No behavior change for projects where some work is already started — those still hide future-blocked rows by default.

## Problem 2 — Cards bounce back to their original column on the project Board

In `TasksTab.handleDragEnd`, `boardTasks` is read from the function closure. `setBoardTasks` calls from `handleDragOver` updated state but the closure is stale, so:

```
nextTasks = boardTasks          // stale pre-drag-over value
movedTask = nextTasks.find(...) // still has the OLD status
statusChanged = movedTask.status !== originalTask.status   // false
// → no status patch is sent to the DB
// → useEffect([filtered]) snaps the card back
```

### Fix
Refactor `handleDragEnd` in `src/components/pm/project/TasksTab.tsx`:

1. Compute the authoritative post-drop list synchronously from the snapshot:
   - Start from `snapshotRef.current` (pre-drag state).
   - Determine `newStatus` directly from `overContainer` + active task (same logic `handleDragOver` uses).
   - Apply `arrayMove` for same-column reorder, or splice into end of `overContainer` for cross-column move.
   - Use this list as both the value passed to `setBoardTasks(...)` AND the basis for the persistence loop.
2. Use a functional `setBoardTasks(curr => ...)` for the optimistic UI update so we never depend on stale closures.
3. Compute `statusChanged` against the snapshot, not the closure copy.
4. On persistence error, restore from `snapshotRef.current` (unchanged) and toast.

This makes the same-column reorder, cross-column move, and DB write all derive from one freshly computed array — eliminating the bounce-back.

### Validation
- Open `/pm/projects/<id>` → Tasks tab → should immediately show task rows (no "+46 upcoming" needed).
- Switch to Board view → drag a card from "Ready" → "In Progress" → card stays put, toast confirms, refresh persists.
- Drag within the same column to reorder → order survives a reload.
- Toggle "Hide upcoming" → choice persists per project.

## Files touched
- `src/components/pm/project/TasksTab.tsx` (default + safety net + handleDragEnd rewrite)

No DB/schema/type changes. No other components affected. `WorkKanban` (global `/pm/work` board) already uses a single `onDragEnd` model with no stale-closure issue and is left untouched.
