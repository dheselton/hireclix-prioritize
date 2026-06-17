## 1. Notes on overhead activity time

**`ActivitiesStrip.tsx`**
- When an activity timer is running, show an inline "What are you working on?" input next to the elapsed time. Value is held in local state per running activity; on Stop, pass it to `stop(note)`.
- In `QuickLogMenu`, add a "Note (optional)" input above the +15/+30/+1h row. Forward `note` through `onPick(mins, note)` → `quickLog(activity, mins, note)` → `addTimeEntry({ ..., note })`.

**`ActiveTimerProvider.tsx`**
- Already accepts `stop(note?)` and persists `note` into `pm_time_entries`. No schema changes — just make sure the activity timer's running note from `ActivitiesStrip` and `FloatingTimerTray` is what reaches `stop()`.

**`FloatingTimerTray.tsx`**
- When `current.activityId` is set, render a compact note input inside the tray (replacing the static label row with label + small input). The input value is passed into `stop(note)` when the user clicks the stop button.

**`EntryPopover.tsx`**
- Already supports notes for both task and activity entries — no change needed (verified in current file).

No DB migration. No changes to `TimesheetGrid` / `TimeEntriesList` (they already render notes via existing fields).

## 2. Timer font: use body font everywhere

Remove `font-mono` from every visible timer/clock element so they inherit the app body font (Inter). Keep `tabular-nums` so digits stay aligned.

Files to edit:
- `src/components/pm/workspace/TimerPill.tsx` — running + idle pill spans
- `src/components/pm/timer/FloatingTimerTray.tsx` — elapsed time line
- `src/components/pm/timer/TimerControls.tsx` — elapsed pill
- `src/components/pm/time/TimeTrackerCard.tsx` — large timer display, recent-entry duration column
- `src/components/pm/time/ActivitiesStrip.tsx` — running elapsed span
- `src/components/pm/time/EntryPopover.tsx` — `EntryRow` duration span
- `src/components/pm/time/TimesheetGrid.tsx` and `src/components/pm/time/TimeEntriesList.tsx` — audit any `font-mono` next to `fmtDur` / `tabular-nums` and remove

Pure presentation: only `font-mono` utility removed; no logic, layout, or component structure changes.

## Out of scope
- No DB migration
- No changes to timer business logic
- No global font/CSS edits