# Agency Project Management Platform — Build Plan

Transform the current app into a full-featured PM platform for a creative + dev agency, while keeping the existing HireClix Roadmap pages reachable from a "Roadmap (Legacy)" sidebar group.

## Approach Summary

- **Keep alongside**: All existing roadmap routes/tables stay; new PM system lives at `/pm/*` and becomes the default landing area.
- **Auth disabled**: A role switcher (PM / Designer / Developer / Submitter) in the top bar mocks the current user and persists in `localStorage`. Real auth wiring stays in place for later re-enable.
- **Everything in one pass**: All 10 screens scaffolded. Realistically the first build will deliver fully working data model + CRUD + most screens; the heaviest pieces (Gantt drag-cascade, form-builder conditionals, outbound webhook delivery) will land functional but rough and get polished in follow-ups.
- **Custom SVG Gantt** with full dependency arrows, drag-to-reschedule, critical path, cascade confirmation modal.

## Database (new tables, all with permissive RLS while auth is off)

```text
mock_users(id, name, role, avatar_url, capacity_hours_per_week)
clients(id, name, notes)
projects(id, title, client_id, type, status, go_live_date, start_date,
         description, tags[], template_id, created_by, custom_fields jsonb)
project_members(project_id, user_id, role)
project_phases(id, project_id, name, sort_order)
tasks(id, project_id, phase_id, title, description, type, status,
      assignee_id, created_by, start_date, due_date, duration_days,
      priority, tags[], sort_order, custom_fields jsonb,
      design_round int, design_approval, dev_blocker, dev_status_log jsonb,
      dev_links jsonb, dev_environment text)
task_dependencies(id, task_id, depends_on_task_id, type, lag_days)
subtasks(id, task_id, title, complete, sort_order)
checklist_items(id, task_id, label, checked, sort_order)
time_entries(id, task_id, user_id, minutes, note, logged_at)
task_attachments(id, task_id, url, name, uploaded_by, uploaded_at)
comments(id, task_id|project_id, user_id, body, mentions uuid[], pinned, created_at)
activity_log(id, project_id, task_id, user_id, action, payload jsonb, created_at)
notifications(id, user_id, type, title, body, link, read, created_at)
project_templates(id, name, type, description, default_go_live_offset_days)
template_tasks(id, template_id, temp_id, title, type, role, duration_days,
               assignee_role, phase_name, sort_order, checklist_items jsonb)
template_dependencies(id, template_id, from_temp_id, to_temp_id, type, lag_days)
forms(id, name, client_id, submit_action jsonb, webhook_url, auth_token,
      shareable_slug, notify_emails text[])
form_fields(id, form_id, label, type, required, placeholder, options jsonb,
            conditionals jsonb, sort_order)
form_submissions(id, form_id, payload jsonb, created_project_id, created_task_id,
                 status, submitter_name, submitter_email, created_at)
webhooks(id, name, target_url, events text[], headers jsonb, enabled, secret)
webhook_deliveries(id, webhook_id, event, payload jsonb, response_status,
                   response_body, attempted_at)
client_environments(id, client_id, name, prod_endpoint, staging_endpoint,
                    contacts jsonb, notes, integrations jsonb)
```

Seed: 4 mock users (one per role), 2 clients, 1 sample project per major type, 2 templates (Career Site, Quick Creative).

## Routing & Layout

- `/pm` — Work Queue (new default home)
- `/pm/board` — Kanban Board
- `/pm/projects` — Project List
- `/pm/projects/:id` — Project Detail (tabs: Overview / Tasks / Timeline / Files / Activity / Forms / Integrations)
- `/pm/workload` — Team Workload
- `/pm/timeline` — Global Timeline
- `/pm/forms` — Form list + Builder
- `/pm/forms/:id/edit` — Form Builder
- `/f/:slug` — Public form submission page (no app chrome)
- `/pm/templates` — Template list + Builder
- `/pm/templates/:id/edit` — Template Builder
- `/pm/integrations` — Webhooks, API logs, client environments
- `/roadmap/*` — existing roadmap pages, moved under a "Roadmap (Legacy)" sidebar group

Top bar gets: role switcher, mock-user picker, notifications bell, global search.

Task Detail is a right-side `Sheet` drawer reachable from any view via `?task=:id` query param (deep-linkable).

## Dependency Cascade Engine

Pure TS module `src/lib/pm/scheduler.ts`:

- Builds DAG from `task_dependencies`.
- `recalculateForward(changedTaskId)` — propagates `due_date`/`duration_days` changes downstream respecting `finish_start | start_start | finish_finish` + `lag_days`.
- `recalculateBackwardFromGoLive(projectId, newGoLiveDate)` — reverse-schedules entire project.
- `computeCriticalPath(projectId)` — longest-duration chain ending at go-live.
- Returns a **diff** `{ taskId, oldStart, oldEnd, newStart, newEnd }[]` — never writes directly.
- A shared `<CascadeConfirmModal>` shows the diff and a "this pushes past go-live" warning before the caller commits.

Used by: due-date edits in Task Drawer, Gantt bar drags, project go-live edits, template instantiation.

## Screens

1. **Work Queue** (`/pm`) — Morning Digest stats, alert strip (overdue/blocked/waiting on you), Unclaimed Requests with one-click Claim, My Tasks grouped Today/This Week/Later, Watching list.

2. **Board** (`/pm/board`) — 7-column DnD Kanban (`@dnd-kit`), filters bar, blocked cards red-bordered, click opens Task Drawer.

3. **Project List** (`/pm/projects`) — sortable/filterable table, progress %, member avatars.

4. **Project Detail** (`/pm/projects/:id`) — header with editable go-live (cascade modal), 7 tabs:
   - **Overview**: brief, key dates, recent activity, blockers, stats.
   - **Tasks**: phase-grouped list, inline status/assignee edits, drag reorder, dependency arrows, inline add.
   - **Timeline**: custom SVG Gantt — bars colored by role, dependency lines (SVG paths with arrowheads), critical path bold, today line, milestone diamonds, drag bar → cascade modal, week/month/full zoom.
   - **Files**: attachments grouped by task, project-level upload (Supabase storage bucket `pm-files`), image previews, external links.
   - **Activity & Comments**: feed with filter (comments/activity/all), `@mention` autocomplete from project members, pin support.
   - **Forms & Intake** (PM only): linked forms, submissions list, raw payload viewer, field re-mapping.
   - **Integrations** (PM + Dev): webhook list, last 50 API events, client environment block, dev append-only status log.

5. **Task Detail Drawer** — two-column sheet, all fields editable inline, type-specific sections (Design rounds tracker / Dev blocker + status log + links + env). Due-date change runs scheduler and shows cascade modal if downstream tasks would shift.

6. **Team Workload** (`/pm/workload`) — per-user capacity bars (tasks-this-week vs `capacity_hours_per_week`), green/yellow/red, reassign popover.

7. **Global Timeline** (`/pm/timeline`) — same SVG engine, one row per project (expandable to tasks), filters.

8. **Form Builder** (`/pm/forms/:id/edit`) — 3-pane: field palette (DnD), live canvas, settings panel. Conditional logic UI: per-field `if [field][operator][value] then [show|hide|require]`. Field mapping UI maps form fields → project/task fields. Public `/f/:slug` renders the form, evaluates conditionals client-side, on submit creates project or task per `submit_action`, fires optional webhook, drops into Unclaimed queue, notifies PMs.

9. **Template Builder** (`/pm/templates/:id/edit`) — phase groups, task rows (title/role/type/duration/checklist), visual dependency connector (click "depends on" → pick predecessor), default go-live offset. "Create Project from Template" action computes all dates from go-live working backwards via scheduler.

10. **Integrations** (`/pm/integrations`) — Inbound (form endpoints + test payload sender), Outbound webhooks (event toggles + delivery log), Client Environments CRUD. Outbound delivery via `send-webhook` edge function triggered on key events.

## Key Behaviors

- **Claim** action: sets assignee = mock current user, status = `in_progress`, writes activity row, creates notification for project PM(s).
- **@mentions**: parsed from comment body, create `notifications` rows + (later) email via existing Resend setup — email wiring stubbed behind a feature flag for now.
- **Blocked tasks**: surfaced in Work Queue alert strip, Board (red border), Project Overview blockers list, Workload view.
- **Role-based defaults**: Work Queue, Board, and Project Tasks tab pre-filter by current role; toggle to "All".
- **Time tracking**: per-task quick-log button + per-user breakdown; project header shows aggregated total.
- **Activity logging**: a `logActivity()` helper called from all mutation services so every change shows up in feeds.

## Edge Functions

- `submit-form` — public, validates + creates project/task from form submission, fires inbound webhook log + outbound `task.created` webhook.
- `send-webhook` — delivers outbound webhook with HMAC signature header, records `webhook_deliveries`.
- (existing `send-reminder-email` reused for due-date reminders.)

## Files (new — high level)

```text
src/pages/pm/
  WorkQueue.tsx  Board.tsx  ProjectList.tsx  ProjectDetail.tsx
  Workload.tsx  GlobalTimeline.tsx  Forms.tsx  FormBuilder.tsx
  PublicForm.tsx  Templates.tsx  TemplateBuilder.tsx  Integrations.tsx
src/components/pm/
  TopBarRoleSwitcher.tsx  NotificationsBell.tsx
  TaskDrawer.tsx  TaskCard.tsx  TaskListRow.tsx
  CascadeConfirmModal.tsx  GanttChart.tsx  GanttBar.tsx  DependencyArrows.tsx
  KanbanColumn.tsx  ProjectHeader.tsx  PhaseGroup.tsx
  CommentsThread.tsx  ActivityFeed.tsx  AttachmentsGrid.tsx
  WorkloadCard.tsx  MorningDigest.tsx  UnclaimedList.tsx  MyTasksList.tsx
  form-builder/  (FieldPalette, FormCanvas, FieldEditor, ConditionalEditor, FieldMapping)
  template-builder/  (PhaseEditor, TaskRow, DependencyPicker)
  integrations/  (WebhookList, WebhookForm, DeliveryLog, ClientEnvList)
src/lib/pm/
  scheduler.ts  (cascade engine + critical path)
  mockUser.ts   (current-user/role from localStorage)
  activity.ts   (logActivity helper)
  notifications.ts
  formEvaluator.ts  (conditional logic evaluator)
  api/  (projects.ts, tasks.ts, forms.ts, templates.ts, webhooks.ts, comments.ts, files.ts)
src/types/pm.ts
src/components/AppSidebar.tsx  — restructure: PM group (default) + Roadmap (Legacy) group
supabase/functions/submit-form/index.ts
supabase/functions/send-webhook/index.ts
```

## What's intentionally rough in v1

- Outbound webhook retries: single-attempt, no backoff queue.
- Form builder conditionals: AND-only within a field (no OR groups).
- Gantt: drag-to-reschedule snaps to days (no hour granularity).
- Email notifications: in-app only; email send behind a flag (Resend wiring already exists for roadmap).
- "Doppler integration" for secrets: shown as a placeholder panel only.

These can each be hardened in follow-up passes once the skeleton is in your hands.
