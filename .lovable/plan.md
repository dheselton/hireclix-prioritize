
# Daily Briefing Dashboard — Work Queue Redesign

Rebuild `src/pages/pm/WorkQueue.tsx` as a personalized daily briefing, replacing the current list-driven view.

## Important adaptation to this project

Auth is currently **disabled** in this codebase. The "current user" comes from `useCurrentUser()` against `mock_users` (PM/Designer/Developer/Submitter), persisted in localStorage. We will:

- Use `current_user.id` (mock user id) everywhere your spec references `auth.uid()`.
- Create `pm_notes` with a plain `user_id uuid` column (no FK to `auth.users`) and permissive RLS matching the rest of the `pm_*` tables. When auth is re-enabled later we tighten policies in a single migration alongside the other PM tables — noted in the existing memory.
- "Me Mode" already exists globally (`useMeMode` + `MeModeToggle` in TopBar). We reuse it; we do NOT add another toggle.

Date format stays mm/dd/yyyy (`fmtDate` from `src/lib/pm/format.ts`).

## 1. Database migration

Single migration adding `pm_notes`:

- Columns: `id`, `user_id` (uuid, not null), `content` (text, not null), `due_date` (date, null), `is_completed` (bool default false), `created_at`, `updated_at`.
- Indexes on `user_id` and `due_date`.
- `update_updated_at_column` trigger.
- GRANTs to anon/authenticated/service_role + permissive RLS (true) to match existing `pm_*` table pattern while auth is off.

## 2. Page layout

`src/pages/pm/WorkQueue.tsx` becomes a thin composition:

```text
<DailyBriefingHero />
<div grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4>
  <QuickTasksColumn />
  <ProjectWorkColumn />
</div>
<NotesSection />
```

Existing toolbar / chip filters / kanban/list toggle on WorkQueue are removed from this page (the deep-link views in `links.ts` still serve filtered Work Queue use cases via `buildQueueLink`). Hero stat chips and "View all →" links use `buildQueueLink` so callouts remain clickable per the Core memory rule.

## 3. Components (all new, under `src/components/pm/workqueue/`)

### DailyBriefingHero.tsx
- Dark gradient card (`bg-gradient-to-r from-slate-800 to-slate-700`), white text, `rounded-xl p-5 mb-4`.
- Time-of-day greeting + first name from `mock_users.name`.
- Stat chips (overdue, quick tasks, active projects, blocked) — each chip is a `Link` built from `buildQueueLink({ ... })` so clicking jumps to a pre-filtered queue / project list view. Blocked chip only renders when count > 0.
- Counts derived from a single fetch (see Data section).

### QuickTasksColumn.tsx
- Card wrapper, header "⚡ QUICK TASKS".
- Shows up to 5 tasks where the parent project's `work_type = 'request'` (quick request) and assignee = current user, status not in done/approved/complete.
- Each row: status dot, title, project name, due badge (Overdue / Today / mm/dd). Click opens full workspace via `useTaskDrawerLink().open(task.id)`.
- Footer: "X more in queue" + "View all →" → `buildQueueLink({ workType: 'request', assignee: 'me' })`.

### ProjectWorkColumn.tsx
- Header "📁 PROJECT WORK".
- Up to 5 active projects where current user is a `pm_project_members` row (or created_by), `work_type = 'project'`, status active.
- Per project renders `<ProjectBriefingCard />`:
  - Header: title, status badge (overdue / due today / on track), "Open →" → `/pm/projects/:id`.
  - Progress bar using `Progress` from `@/components/ui/progress` (completed / total tasks) + go-live date.
  - "MY NEXT UP (3 OF X)" — up to 3 of my tasks in that project, sorted overdue→today→upcoming. Color-coded 3px left border + dot. Click opens full task workspace.
  - Footer: "+ N more tasks" + "Open project →".

### NotesSection.tsx + NoteDialog.tsx
- Gray container, header "📝 MY NOTES & REMINDERS" + "+ Add note" button.
- Pills (rounded-full) showing note text + due-date badge. Color tokens:
  - Overdue → `bg-destructive/15 text-destructive`
  - Today → amber tokens
  - Soon (≤7d) → `bg-primary/15 text-primary`
  - No date → muted
- Click pill → opens `NoteDialog` for edit (content textarea, `DatePicker` from `src/components/ui/date-picker.tsx`, "mark completed" checkbox, Delete + Save).
- "+ Add note" → same dialog in create mode.
- Lists incomplete notes for current user, ordered overdue → today → soon → no-date → completed-hidden, limit 10, with "+ N more" expand.

## 4. Data layer

Add `src/lib/pm/briefing.ts` with:

- `useBriefingCounts(userId)` — single query joining `pm_tasks` + `pm_projects` + `pm_project_members`, returns `{ overdue, quickTasks, activeProjects, blocked }`.
- `useQuickTasks(userId)` — tasks where `pm_projects.work_type='request'`, `assignee_id=userId`, status not terminal, limit 5, sorted overdue→today→future.
- `useMyActiveProjects(userId)` — projects where membership row exists OR `created_by=userId`, `work_type='project'`, status active. Returns aggregate `{ total, completed, overdue }` per project (single grouped fetch).
- `useMyTopTasksForProject(projectId, userId)` — top 3 my-tasks per project (batched fetch for the visible project IDs).
- `useMyNotes(userId)` + mutations (`createNote`, `updateNote`, `deleteNote`, `toggleComplete`).

All hooks use existing `supabase` client and the project's bumpRefresh pattern from `src/lib/pm/refresh.ts` so other PM pages stay in sync.

## 5. Responsive behavior

- `≥lg`: two columns (Quick Tasks | Project Work).
- `md`: stacked.
- `<md`: hero collapses chip row to wrap; Quick Tasks limit 3; Project Work limit 2 (2 tasks each); Notes limit 5 + "+ N more".

## 6. Files

**New**
- `supabase/migrations/<ts>_pm_notes.sql`
- `src/components/pm/workqueue/DailyBriefingHero.tsx`
- `src/components/pm/workqueue/QuickTasksColumn.tsx`
- `src/components/pm/workqueue/ProjectWorkColumn.tsx`
- `src/components/pm/workqueue/ProjectBriefingCard.tsx`
- `src/components/pm/workqueue/NotesSection.tsx`
- `src/components/pm/workqueue/NoteDialog.tsx`
- `src/lib/pm/briefing.ts`

**Modified**
- `src/pages/pm/WorkQueue.tsx` — replaced with briefing composition.
- `mem://index.md` — note new dashboard + pm_notes table.

## 7. Out of scope (per your spec)

- No new global "Me Mode" toggle — already exists (`MeModeToggle` in TopBar, hotkey M).
- No changes to the existing deep-linked filtered Work Queue (those routes remain reachable via `buildQueueLink` and from hero chips).
- No realtime channel on `pm_notes` for v1 (manual refresh after mutations via `bumpRefresh`).
