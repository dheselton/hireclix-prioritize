## Context card above Control Panel

Add a small "At a glance" card at the top of the right sidebar in `src/pages/pm/TaskWorkspace.tsx`, rendered above `<ControlPanel>`.

### What it shows

- **Client** — name, linked to that client's project list (or the project page if no client filter exists). Internal HireClix gets the purple `internal-pill`.
- **Project** — title, linked to `/pm/projects/:id`.
- **Request type** — pretty-printed `custom_fields.request_type` (e.g. "Landing page"). Only shown when the parent project is `work_type === 'request'`.
- **Work type** — small pill ("Request" / "Project") via existing `WorkTypeBadge`.
- **Phase** — phase name when present.
- **Requested by** — avatar + name from `pm_projects.requested_by` → `mock_users`.

### Implementation

1. New component `src/components/pm/workspace/TaskMetaCard.tsx`:
   - Props: `projectId: string`, `phaseName?: string | null`.
   - Single Supabase fetch: `pm_projects` (`title, work_type, custom_fields, client_id, requested_by, clients(name, is_internal)`).
   - Renders a compact label/value grid using the same visual style as `ControlPanel` (rounded border, `bg-card`, `CONTROL PANEL`-style header reading "AT A GLANCE").
   - Uses `useInternalClientIds()` for the internal badge.
   - Uses existing `UserAvatar` for "Requested by".
2. In `TaskWorkspace.tsx`, render `<TaskMetaCard projectId={task.project_id} phaseName={crumbs.phaseName} />` as the first child of the right `<aside>`, immediately above `<ControlPanel>`.
3. No schema or data changes — everything is already on the project row.

### Out of scope

- Editing client/project from this card (read-only links).
- Showing custom_fields Q&A here (that already lives in `RequestContextPanel` on the left column).
