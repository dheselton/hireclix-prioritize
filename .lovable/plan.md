# Overhead time tracking (no more "forever tasks")

## The problem
Today, time can only be logged against a `pm_task`. To capture meetings, learning, admin, etc., people create permanent placeholder tasks (like the ClickUp screenshot: Meetings, General Items, UI/UX Learning, Inspiration Searches…). These pollute boards, the briefing, workload, and Gantt — they're not real work, they never close, and they make every "open tasks" count lie.

## The fix: Overhead Activities
Introduce a separate, lightweight concept — **Activities** — that exists ONLY for time logging. They are not tasks. They never appear in Work Queue, Briefing, Board, Gantt, Workload counts, or project task lists. They only show up where time is logged or summarized.

Think of them as time-tracking categories with a name and an optional client/project tag.

```text
TIME ENTRY can now point to either:
  ├─ task_id  (real work — unchanged)
  └─ activity_id  (overhead bucket — new)
```

## What users see

### 1. New "Activity" picker in every time-logging surface
Anywhere a user logs time today (TimerPill, TimeTrackerCard, TimeLogDialog, Timesheet EntryPopover, manual entries), the "What are you working on?" picker becomes a 2-tab combobox:
- **Tasks** (default) — existing search
- **Activities** — pick from their personal + team activities; "+ New activity" inline

Starting the global timer on an Activity works identically — FloatingTimerTray shows the activity name with a small `Activity` chip instead of a task title.

### 2. Default activity catalog (seeded once)
- Meetings
- Learning & Development
- General / Admin
- Internal Projects (catch-all)

PMs can add/rename/archive in a simple `/pm/time/activities` settings panel. Each activity has: name, icon/color, optional default client (e.g. tag all "Internal Projects" hours to HireClix), billable default (off), archived flag.

### 3. Timesheet & entries view
`/pm/time` already groups by task. New behavior:
- Activity rows render with an `Activity` pill and the activity name instead of project/task breadcrumbs.
- "By client" tile gains an **Overhead** bucket for activities with no client.
- New summary tile: **Overhead** (sum of activity minutes) alongside Total / Billable / Non-billable.

### 4. Nothing changes for real tasks
Boards, Briefing unclaimed counts, Workload bars, Gantt, project task counts — none of them ever see activities. The "15 open subtasks" problem goes away because Meetings/L&D/General are no longer tasks at all.

## Why this beats alternatives
- **vs. a hidden "Overhead" project with tasks**: still pollutes task tables, still needs status, still shows up in queries that filter by project.
- **vs. a `task.is_overhead` flag**: every existing view would need a filter; easy to forget and leak.
- **vs. free-text notes on entries**: no aggregation, no per-category totals, no consistency across people.

A separate table is one migration and one picker change, and it keeps the task model clean forever.

---

## Technical section

### Schema (one migration)
```sql
create table public.pm_activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,                       -- lucide name
  color text,                      -- hex for pill
  default_client_id uuid references public.clients(id) on delete set null,
  billable_default boolean not null default false,
  is_archived boolean not null default false,
  created_by uuid,                 -- mock_users.id (nullable while auth off)
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pm_activities to authenticated;
grant select on public.pm_activities to anon;     -- read-only for switcher
grant all on public.pm_activities to service_role;
alter table public.pm_activities enable row level security;
create policy "activities readable" on public.pm_activities for select using (true);
create policy "activities writable" on public.pm_activities for all using (true) with check (true);
-- (permissive while VITE_PM_AUTH_ENABLED is off, matches existing pm_* tables)

alter table public.pm_time_entries
  add column activity_id uuid references public.pm_activities(id) on delete set null,
  alter column task_id drop not null,
  add constraint pm_time_entries_target_chk
    check ((task_id is not null) <> (activity_id is not null));
```

Seed: insert the 4 default activities in the same migration.

### Code touchpoints (frontend only after migration)
- `src/lib/pm/time.ts` — `TimeEntry`/`EnrichedEntry` gain `activity_id`, `activity_name`, `activity_color`; `addTimeEntry` accepts `activity_id` xor `task_id`; `fetchEnrichedEntries` joins `pm_activities`. `buildWeekGrid` keys by `task_id ?? activity_id`.
- `src/lib/pm/activities.ts` (new) — `useActivities()`, `createActivity()`, `archiveActivity()`.
- `src/components/pm/time/ActivityPicker.tsx` (new) — combobox used inside…
- `src/components/pm/workspace/TimeLogDialog.tsx`, `src/components/pm/time/EntryPopover.tsx`, `src/components/pm/time/TimeTrackerCard.tsx`, `src/components/pm/timer/ActiveTimerProvider.tsx` (timer state gains optional `activityId`), `FloatingTimerTray.tsx`, `TimerPill.tsx`.
- `src/pages/pm/Timesheet.tsx` + `TimesheetGrid` / `TimeEntriesList` — render activity rows with `Activity` pill; add **Overhead** summary tile.
- `src/pages/pm/TimeActivities.tsx` (new) + sidebar entry under Time — PM-only manage screen (list / add / rename / archive).

### Out of scope
- No changes to tasks, board, briefing, workload, Gantt.
- No new permissions model; reuse PM role check for the manage screen.
- Reporting/exports beyond what Timesheet already shows.

## Open questions
1. Should non-PMs be able to create personal activities, or only PMs manage the global list? (Plan assumes PM-only.)
2. Default billable = **false** for all seeded activities — confirm?
3. Want a hard cap so activities can't exceed e.g. 8h/day per user, or leave uncapped?
