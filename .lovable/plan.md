# Task Workspace Refactor (Execution-First)

Turn the Task Drawer into a lightweight Quick Edit, and introduce a Full Task Workspace as the primary task experience. Add a real Links section, rebuild Time Tracking with a global running-timer tray, and demote structural sections.

## 1. Routing & entry points

- Add new route `/pm/tasks/:id` → `TaskWorkspace.tsx` page (full screen, app shell visible).
- Update `useTaskDrawerLink` consumers: clicking a task row/card now navigates to `/pm/tasks/:id`. The drawer (`?task=`) is reserved for **Quick Edit** (opened from a "Quick edit" affordance such as ⋯ menu or shift-click; default click = open workspace).
- Workspace has a back button (returns to previous list/board) and a "Quick edit" toggle that opens the existing drawer in-place.

## 2. Full Task Workspace layout

Two-column at ≥lg, stacked on mobile. Header bar spans full width.

### Header (sticky)
- Title (inline-editable), breadcrumb (Project → Task), status pill.
- Right: **Start Timer / Pause / Stop** controls, "Quick edit", overflow menu.

### Left column (~70%) — Execution
Ordered top to bottom:

1. **Attachments** — promoted to hero block. Grid of image thumbnails (square tiles) + file list below. Full-area drag-and-drop. Reuses `pm_attachments` + `task-attachments` bucket. Visual upgrade only — no schema change.
2. **Links** (NEW) — favicon (via `https://www.google.com/s2/favicons?domain=…&sz=32`), editable label, URL, open-in-new, delete. Inline add row.
3. **Description** — rich/markdown read view by default; edit on click. Form-submission payloads render here as a structured key/value block when present (see §5).
4. **Checklist / Subtasks** — keep `ChecklistSection` + `SubtasksSection`, compact.
5. **Comments** — `CommentsThread`, enlarged, primary collab surface.

### Right column (~30%) — Control panel
Compact card with:
- Status, Assignee, Priority
- Start / Due dates (with existing cascade behavior)
- Client (read-only, from project)
- Total time logged (live, sums `pm_time_entries`)
- Tags

Below, **collapsed by default** accordions:
- Dependencies (`DependenciesSection`)
- Design rounds (design tasks only)
- Dev status log + blocker (dev tasks only)
- Metadata (created/updated, IDs)

## 3. Links (new feature)

New table `pm_task_links`:
```
id uuid pk, task_id uuid, url text, label text, created_by uuid, created_at timestamptz default now()
```
Permissive RLS to match other pm_* tables. New `LinksSection.tsx` component.

## 4. Time Tracking rebuild

### Active timer
- One active timer per user, stored in:
  - `localStorage` (`pm_active_timer = { taskId, taskTitle, startedAt }`) for instant resume.
  - New table `pm_active_timers` (`user_id pk, task_id, started_at, note`) so it survives device switches.
- New context `ActiveTimerProvider` mounted in `App.tsx`, exposing `start(taskId, title)`, `pause()`, `stop(note?)`, `current`.
- Stop → insert into existing `pm_time_entries` with computed minutes (rounded up to nearest minute, min 1).

### Floating tray (global)
- `FloatingTimerTray.tsx` mounted globally (App level). Bottom-right, fixed, z-50.
- Shows task title, live `HH:MM:SS`, Pause/Resume + Stop. Click body → navigates to `/pm/tasks/:id`.
- Hidden when no active timer.

### Manual entry
- Keep current manual hours/minutes + note in the Time section of the workspace, plus full log table below.

## 5. Form → Task connection

- When `pm_form_submissions` creates a task, store the submission payload in `pm_tasks.custom_fields.form_submission = { form_name, fields: [{label, value}] }` (already JSONB, no migration).
- Workspace Description block detects `custom_fields.form_submission` and renders it as a clean labeled block above the free-text description.
- Backfill: read existing submissions and populate `custom_fields` for any task missing it (one-shot SQL via supabase--insert).

## 6. Quick Edit Drawer (simplified)

Reduce `TaskDrawer` to: Title, Status, Assignee, Due date, single Quick Comment box, and a primary **"Open Full Task"** button (navigates to `/pm/tasks/:id`). Remove all heavy sections from the drawer.

## 7. Files

**New**
- `src/pages/pm/TaskWorkspace.tsx`
- `src/components/pm/workspace/AttachmentsHero.tsx`
- `src/components/pm/workspace/LinksSection.tsx`
- `src/components/pm/workspace/FormSubmissionBlock.tsx`
- `src/components/pm/workspace/ControlPanel.tsx`
- `src/components/pm/timer/ActiveTimerProvider.tsx`
- `src/components/pm/timer/FloatingTimerTray.tsx`
- `src/components/pm/timer/TimerControls.tsx`

**Modified**
- `src/App.tsx` — add route, mount `ActiveTimerProvider` + `FloatingTimerTray`.
- `src/components/pm/TaskDrawer.tsx` — strip down to Quick Edit.
- All task click handlers (`TaskKanban`, `TaskListView`, `TaskGridView`, `ProjectWorkCard`, `CommentsThread`, `DependenciesSection`) — default click = navigate to workspace; secondary action opens drawer.
- `src/components/pm/drawer/TimeTrackingSection.tsx` — extend with Start Timer button wired to provider (kept for workspace reuse).
- `src/lib/pm/links.ts` — add `taskWorkspaceLink(id)` helper.

**Migrations**
- Create `pm_task_links` with permissive RLS.
- Create `pm_active_timers` with permissive RLS.

## 8. Out of scope (this round)

- Auth tightening on the new tables (matches current permissive PM RLS until auth re-enabled).
- Rich text editor for description (keep textarea + markdown render).
- Multi-user collaborative cursors / presence.
- Timer idle detection / auto-pause.
- Webhook events for timer start/stop.

## Technical notes

- Timer ticking uses a single `setInterval(1000)` in the provider; tray and header read from context to avoid duplicate intervals.
- `pm_active_timers` upsert keyed on `user_id` ensures the "one active timer" rule.
- `TaskWorkspace` reuses existing section components where possible (`ChecklistSection`, `SubtasksSection`, `CommentsThread`, `DependenciesSection`, `DesignRoundsSection`, `DevStatusLogSection`) — only layout changes.
- Memory rule update after build: add Core line "Tasks open in full workspace at /pm/tasks/:id; drawer is Quick Edit only."
