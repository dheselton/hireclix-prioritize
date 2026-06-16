## Goal

Let PMs edit core project details (not just delete) from the project page header.

## Where it lives

Add an **"Edit project"** item to the existing `…` overflow menu in `src/components/pm/project/ProjectHeader.tsx` (PM-only, above "Delete project"). Selecting it opens a new `EditProjectDialog`.

Also make the project title (`h1`) clickable for PMs as a shortcut — opens the same dialog with a subtle hover affordance ("Click to edit"). Non-PMs see no change.

## Fields editable in the dialog

Mapped to `pm_projects` columns we already have:

- **Title** (`title`, required)
- **Status** (`status`) — draft / active / on_hold / in_review / complete / archived
- **Work type** (`work_type`) — project / retainer / etc. (reuse existing select)
- **Client** (`client_id`) — reuse `ClientSelect`
- **Requester** (`requested_by`) — reuse `RequesterPicker`
- **Go-live date** (`go_live_date`) — date picker (mm/dd/yyyy)
- **Kickoff date** (`kickoff_date`)
- **Start date** (`start_date`)
- **Description** (`description`) — textarea
- **Tags** (`tags`) — simple comma-input

Read-only / out of scope: template_id, created_by, custom_fields, timestamps.

## Behavior

- Save calls a new `updateProject(id, patch)` helper in `src/lib/pm/api.ts` that does a single `pm_projects` update, then `emitTasksChanged()` so headers/lists refresh.
- If `client_id` changes, re-run `applyClientWatchers(projectId, newClientId, null)` so watcher membership stays in sync (same pattern used at intake).
- If `go_live_date` changes, **do not** auto-cascade task dates here — the existing `CascadeConfirmModal` flow on Timeline already handles that. Show a small inline note: "Task dates won't shift automatically — open Timeline to recalculate."
- Toast on success/failure. Close dialog and refresh local `project` via existing `ProjectDetail` query invalidation.

## Permissions

Gated entirely by the existing `isPM` check already in `ProjectHeader`. No new role logic, no schema change. RLS already permissive.

## Files

- **Edit** `src/components/pm/project/ProjectHeader.tsx` — add Edit menu item + dialog mount + clickable title for PMs.
- **New** `src/components/pm/project/EditProjectDialog.tsx` — form, reusing `ClientSelect`, `RequesterPicker`, shadcn `Select`, `Calendar`/`Popover` for dates, `Textarea`.
- **Edit** `src/lib/pm/api.ts` — add `updateProject(id, patch)` (+ export).

## Non-goals

- No bulk-edit, no inline title edit, no project archive workflow changes, no member management UI (already separate).
