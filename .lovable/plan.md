## Goal

Make time tracking a first-class workflow:
1. Designers/devs can log time manually right next to the timer (no separate dialog/section).
2. Anyone can see all their tracked time in a weekly grid, by task and project.
3. Managers (PM role) can see the same view for any team member, switch weeks, and click through to the task or project.

## 1. Unified Timer + Manual Entry control

Replace the current split (`TimerPill` in workspace header, `TimeTrackingSection` accordion in drawer) with a single component `TimeTrackerCard` that lives in the right rail of `TaskWorkspace`.

Top row:
- Big timer display (HH:MM:SS), Start / Stop button, today's total for this task.

Inline "Log time" row (always visible, no expand needed):
- Compact inputs: `hours` `minutes` `date` (defaults today, mm/dd/yyyy) `note`
- Quick chips: +15m / +30m / +1h (log against today)
- Save button → inserts into `pm_time_entries`

Recent entries list (last 5 for this task, all users):
- Avatar · user · duration · date · note · edit/delete (own entries only; PMs can edit any)
- "View all entries" link → opens a filtered Timesheet for this task

Keep `FloatingTimerTray` as-is. Remove the old `TimeTrackingSection` from the drawer to avoid duplication.

## 2. New page: `/pm/time` — Timesheet

New sidebar entry "Time" (Clock icon), visible to all PM users. Route renders `Timesheet.tsx`.

Layout (inspired by the ClickUp screenshot, simplified):

```text
┌─────────────────────────────────────────────────────────────────────┐
│ ◀ May 31 – Jun 6 ▶   [This week ▾]    User: [Me ▾]   [Grid|List]   │
├─────────────────────────────────────────────────────────────────────┤
│                Sun  Mon  Tue  Wed  Thu  Fri  Sat   Total            │
│ Daily totals    0h  9h30 9h08 8h40   0h   0h   0h  27h 18m          │
├─────────────────────────────────────────────────────────────────────┤
│ Task (project · client)  ▶   —  1h05  —    —   —   —   —    1h 05m │
│ ...                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

Row behavior:
- Task title links to `/pm/tasks/:id`. Project/client chip links to `/pm/projects/:id` (honoring the "Actionable = important" core rule).
- Inline play button to start the timer on that task from this view.
- Cell click → popover listing the entries for that task on that day with edit/delete + "Add entry".
- Per-row "..." menu: Add entry, Open task, Open project.

Header controls:
- Week paginator (◀/▶) + quick range dropdown (This week / Last week / This month / Custom).
- User picker: defaults to current user. For PM role, list all non-submitter users + "Whole team". For non-PM, locked to self.
- View toggle: **Timesheet** (grid above) / **Time entries** (flat list, sortable by date/user/task/duration, with filters: client, project, user, billable). List view is the reporting surface.
- Export CSV (entries view).
- Summary strip: total hours, by client, by work type (creative/dev/ops) — each tile is a `<Link>` to the entries view pre-filtered.

## 3. Smaller additions

- `pm_time_entries` already exists with `task_id, user_id, minutes, note, logged_at`. Add `billable boolean default true` via migration so the existing Billable filter chip has real data (kept off by default in UI until users request it — schema only).
- Add helper hooks in `src/lib/pm/time.ts`:
  - `useTimeEntries({ userId?, weekStart?, taskId?, projectId? })`
  - `useTimeWeekGrid(userId, weekStartISO)` → returns `{ days: [...], rows: [{ task, project, perDay: number[7], total }] }`
  - `addTimeEntry`, `updateTimeEntry`, `deleteTimeEntry`
- Permissions: any user can edit/delete their own entries; PM role can edit/delete anyone's (gated by `useCurrentUser().user.role === 'pm'`). RLS stays permissive (auth disabled per project rules).
- Date format mm/dd/yyyy throughout (per core rule).

## 4. Files

New:
- `src/pages/pm/Timesheet.tsx`
- `src/components/pm/time/TimeTrackerCard.tsx` (replaces TimerPill placement; reuses ActiveTimerProvider)
- `src/components/pm/time/WeekPaginator.tsx`
- `src/components/pm/time/TimesheetGrid.tsx`
- `src/components/pm/time/TimeEntriesList.tsx`
- `src/components/pm/time/EntryPopover.tsx` (cell click → add/edit entries for that task+day)
- `src/lib/pm/time.ts`

Edited:
- `src/App.tsx` — add `/pm/time` route
- `src/components/AppSidebar.tsx` — add "Time" item
- `src/pages/pm/TaskWorkspace.tsx` — swap `TimerPill` block for `TimeTrackerCard`
- `src/components/pm/TaskDrawer.tsx` — remove `TimeTrackingSection` (now redundant); keep Quick Edit clean
- `src/components/pm/drawer/TimeTrackingSection.tsx` — delete (or leave + stop importing)
- Migration: `pm_time_entries.billable boolean default true`

## Verification

1. Open a task → `TimeTrackerCard` shows running timer + inline manual entry; logging 30m appears in recent entries instantly and increments the daily total.
2. Navigate to `/pm/time` → weekly grid loads for current user, week paginator works, task/project links open the right views, clicking a cell opens entry popover with edit/delete.
3. Switch role to PM → user picker reveals all team members; selecting Jillian shows her week.
4. Time entries list view filters by client/project/user and exports CSV.
5. mm/dd/yyyy everywhere; daily totals match sum of entries.

## Out of scope

- Approvals / locked timesheets
- Capacity vs. logged comparison (Workload already covers planned capacity)
- Billing/invoice export beyond CSV
