# Fix UTC off-by-one "today" dates

## Problem

Several places compute today's date with `new Date().toISOString().slice(0, 10)`. That converts to UTC, so between local evening and midnight UTC, US-timezone users get *yesterday's* date. This skews due dates, overdue counts, and day columns.

Correct local helpers already exist but are scattered: `localDateISO()` in `src/lib/pm/time.ts`, private `todayIso()` copies in `briefing.ts` and `supportMode.ts`.

## What changes

1. Make `src/lib/pm/format.ts` the single home for date-key helpers:
   - `localDateISO(d: Date)` — local `YYYY-MM-DD`
   - `todayISO()` — `localDateISO(new Date())`
   - `isoDateOffset(days)` — today plus N days, local
   - A clear comment warning never to use `.toISOString().slice(0,10)` for "today".
   - `time.ts` keeps exporting `localDateISO` (re-export) so existing imports don't break.

2. Replace the UTC truncation with the local helper at each requested location:
   - `src/lib/pm/api.ts` (template instantiation date formatter)
   - `src/lib/pm/scheduler.ts` (`fmt`)
   - `src/lib/pm/time.ts` (`weekDays` day keys)
   - `src/lib/pm/snippetIncidents.ts` (`isoDateOffset`)
   - `src/lib/pm/notifications.ts` (today's dedup key)
   - `src/components/pm/project/KpiStrip.tsx` (overdue cutoff)
   - `src/pages/pm/PublicForm.tsx` (project start date)

3. Add an ESLint guard in `eslint.config.js` using `no-restricted-syntax` that flags `.toISOString()` followed by `.slice(0,10)` / `.split('T')[0]`, with a message pointing to `todayISO()` / `localDateISO()`. Set as a warning so it doesn't block builds.

## Out of scope

No other date/time logic changes; dates continue to be stored as ISO `YYYY-MM-DD` strings in the database. Other files with the same pattern (CreateWorkDialog, TasksTab, OverviewTab, GanttChart, TimesheetGrid, etc.) are not touched in this pass — the new lint rule will surface them for a follow-up.
