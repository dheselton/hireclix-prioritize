# Intake forms: quick client creation, requester assignment, attachments & links

Three gaps in the work-intake flow today. All three apply to **Quick Request**, **Blank Project**, and **Public/Embedded Form** entry points.

## 1. Quick "Create new client" inline

**Where:** Client `<Select>` in
- `CreateWorkDialog` → Quick Request step
- `CreateWorkDialog` → Blank Project step
- (Bonus) `ConvertToProjectModal` if we surface a client field there later

**Behavior:**
- Add an "+ New client…" item at the bottom of every client dropdown.
- Clicking it opens a tiny inline `NewClientPopover` (name + optional notes).
- On save: `insert into clients`, refresh local `clients` list, auto-select the new one, toast confirmation.
- No page navigation, no losing form state.

New component: `src/components/pm/ClientSelect.tsx` — wraps the existing `Select` and exposes `value/onChange/clients/onClientsChanged`. Replaces the inline `Select` blocks in the three places above so behavior stays identical everywhere.

## 2. Assign to requester

Today the request creator silently becomes the assignee of every quick task. We need a separate "Requested by / Assign updates to" person so an account manager can file a landing-page request on behalf of a client and still own visibility.

**Schema (migration):**
- `pm_projects` → add `requested_by uuid` (nullable, references `mock_users.id` logically).
- `pm_tasks` already has `assignee_id`; we'll set it to the requester so the project shows up in their Work Queue / Briefing.

**UI changes:**
- `CreateWorkDialog` Quick Request: new "Requested by" picker (defaults to current user, searchable list of `mock_users`). Persists to `pm_projects.requested_by` and is applied as `assignee_id` on the auto-created quick tasks.
- `CreateWorkDialog` Blank Project: same "Requested by" picker (project-level only).
- `PublicForm`: optional "Assign updates to" picker shown when the form has `kind = "internal"` (or always, if useful). Public submitters still just fill name/email.
- Project header (`ProjectHeader`) and Briefing cards: display the requester badge so they can find their requests; already-flagged "My projects" filter will include projects where `requested_by = currentUser`.

## 3. Attachments and links on every intake form

Right now attachments and links only exist on tasks after creation. They need to be capturable at submit time.

**Approach (no schema change needed):**
- `pm_attachments.task_id` and `project_id` are already nullable; `pm_project_attachments` exists; `pm_task_links` exists.
- New shared component `src/components/pm/intake/IntakeAttachmentsField.tsx`:
  - Lets the user stage file uploads (drag/drop + browse) and reference links (URL + optional label) before submit.
  - Holds them in local state — nothing hits the DB until the parent form submits.
- New helper in `src/lib/pm/api.ts`:
  - `persistIntakeAttachments({ projectId, taskId, files, links, userId })` — uploads files to the `task-attachments` bucket, inserts into `pm_attachments` (task-scoped) or `pm_project_attachments` (project-scoped), and inserts links into `pm_task_links` (or a project-level link row — see below).
- Wire it into:
  - **CreateWorkDialog → Quick Request**: attach to the first auto-created task + project.
  - **CreateWorkDialog → Blank Project**: project-level attachments via `pm_project_attachments`.
  - **PublicForm**: same — attach to the created task or project depending on the form's `submit_action`.
- Small migration: add `pm_project_links` table (mirror of `pm_task_links` but `project_id`) so project-level reference links have a home. Project attachments table already exists.

## Files to touch

```text
NEW  src/components/pm/ClientSelect.tsx
NEW  src/components/pm/NewClientPopover.tsx
NEW  src/components/pm/intake/IntakeAttachmentsField.tsx
NEW  src/components/pm/intake/RequesterPicker.tsx
EDIT src/components/pm/CreateWorkDialog.tsx
EDIT src/pages/pm/PublicForm.tsx
EDIT src/lib/pm/api.ts                (createProject + persistIntakeAttachments)
EDIT src/components/pm/project/ProjectHeader.tsx   (show requester)
EDIT src/components/pm/workqueue/ProjectBriefingCard.tsx  (show "Requested by you" tag)
MIG  add pm_projects.requested_by + pm_project_links table (+ grants + permissive RLS to match existing pm_* tables)
```

## Technical notes

- Mock-user mode: `requested_by` stores a `mock_users.id`, same pattern as `assignee_id`. When real auth lands, swap to `auth.uid()`.
- All new `pm_*` rows follow the existing permissive public RLS + GRANT pattern (auth is disabled in dev).
- File uploads reuse the existing public `task-attachments` bucket; for project-only attachments the path is `project/${projectId}/...`.
- Briefing's "My projects" hook already filters on assignee; will extend to include `requested_by = currentUser.id` so account-manager submissions stay visible without them being the assignee.

Confirm and I'll implement.
