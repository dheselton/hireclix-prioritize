## Problem

1. **Date pickers truncate** — The shared `DatePicker` (`src/components/ui/date-picker.tsx`) uses `flex-1 truncate` on the label and call sites force narrow widths (e.g. `w-32` in `ControlPanel.tsx`, similar in `OverviewTab.tsx`, `DesignRoundsSection.tsx`, `CreateWorkDialog.tsx`, etc.). At `h-7 w-32 text-xs`, the calendar icon + `MM/dd/yyyy` + clear `X` will not fit, so dates show as `05/…`.
2. **Timer pill uses `font-mono`** — `TimerPill.tsx` displays `00:00:00` in `font-mono`, which clashes with the rest of the app (Roboto / Inter sans).

## Fix

### 1. `src/components/ui/date-picker.tsx`
- Remove the forced single-line `truncate` on the date label; use `whitespace-nowrap` instead so it never gets cut off — the button can grow with content.
- Set a sensible default `min-width` per size (`sm` → `min-w-[8.5rem]`, default → `min-w-[10.5rem]`) so the full `MM/dd/yyyy` always fits even when the parent passes no explicit width.
- Reduce icon/spacing on `sm` size slightly and right-pad to make room for the clear `X` without overlapping the date.
- Keep the existing `MM/dd/yyyy` format (matches project rule).

### 2. Audit call sites and remove width constraints that cause clipping
- `src/components/pm/workspace/ControlPanel.tsx` — Due Date and Environment rows: drop `w-32`/`w-36`, allow the right-aligned control to grow naturally inside the row (row already uses `justify-between`).
- `src/components/pm/project/OverviewTab.tsx` — Key Dates date pickers: ensure they're full-width inside their grid cell (remove any fixed widths).
- `src/components/pm/drawer/DesignRoundsSection.tsx`, `src/components/pm/CreateWorkDialog.tsx`, `src/components/pm/TaskDrawer.tsx`, roadmap `OverviewTab/QATab/RolloutTab/NewFeatureDrawer` — sanity pass: anywhere a fixed narrow `w-*` clips the picker, switch to `w-full` or remove the width prop and rely on the new sensible min-width.

No business logic, no API, no schema changes.

### 3. `src/components/pm/workspace/TimerPill.tsx`
- Replace `font-mono` on both the running clock (`{formatHMS(elapsedMs)}`) and the idle `00:00:00` with the project sans stack and keep `tabular-nums` so digits stay aligned and the pill doesn't jitter.
- Keep size, weight, pill chrome, and the Play/Stop buttons unchanged.

## Out of scope
- No changes to date storage format, scheduler, or any other behavior.
- Calendar popover itself stays as-is — the bug is purely the trigger button.
