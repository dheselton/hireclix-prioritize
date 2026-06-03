# Broken snippet incident workflow

When a shared snippet breaks, give a snippet owner a one-click way to spin up an individual follow-up task on every site that uses that snippet, and keep all those tasks visibly tied back to a single incident so completion can be tracked per site.

## Concept

- An **incident** = "this snippet is broken; here's what's wrong; these N sites need fixing."
- One incident → many tasks (one task per affected project).
- Each task stays a normal `pm_tasks` row so it flows through Work Queue, assignment, time tracking, and status like anything else.
- The incident is the connective tissue surfacing the relationship.

## Schema — one new table, additive only

```sql
CREATE TABLE public.pm_snippet_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snippet_id uuid NOT NULL REFERENCES pm_snippets(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'high',  -- low | medium | high | critical
  reported_by uuid REFERENCES mock_users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Plus GRANTs + permissive RLS to match the rest of `pm_*`.

**Task linkage** uses the existing `pm_tasks.custom_fields jsonb`:

```json
{ "snippet_incident_id": "<uuid>", "snippet_id": "<uuid>" }
```

No schema change to `pm_tasks` — keeps tasks normal everywhere they already appear.

## UX flow

### 1. Trigger: "Report broken" on the snippet card

In `SnippetCard.tsx`, add an item to the existing `…` dropdown: **"Report broken"** (between Duplicate and Delete; AlertTriangle icon, destructive-ish color). Opens `ReportBrokenSnippetDialog`.

### 2. The dialog — `src/components/pm/snippets/ReportBrokenSnippetDialog.tsx`

Single-screen workflow using existing primitives (`Dialog`, `Input`, `Textarea`, `Select`, `Checkbox`, `Avatar`):

- **What's broken?** — `Input` (incident title, defaults to `"{Snippet} broken"`).
- **Details** — `Textarea` (what's failing, repro steps, expected fix). Becomes the description copied onto every follow-up task.
- **Severity** — `Select`: Low / Medium / High (default) / Critical → maps to task `priority`.
- **Affected sites** — auto-populated list from real usage (same query as `SnippetUsageFooter`: distinct project_ids from `pm_task_snippets` → `pm_tasks` → `pm_projects`). Each row = `Checkbox` (default checked), project name, client name, current open task count from this snippet, optional `Select` to pick an assignee from that project's team (`pm_project_members`). "Select all / none" header control.
- **Add to projects not currently using the snippet** — secondary `MultiSelect` / popover (optional) so a PM can add a site that has the snippet but isn't linked yet.
- **Submit** button: "Create N follow-up tasks".

### 3. On submit

1. Insert one `pm_snippet_incidents` row.
2. For each selected project, call `createTask` with:
   - `project_id` = that project
   - `title` = `"[Broken snippet] {snippet.title} — {project.title}"`
   - `description` = incident description
   - `type` = `"bug"` (falls back to `"dev"` if `bug` not in app's type set — see Technical notes)
   - `priority` = mapped severity
   - `status` = `"unclaimed"` (or `"claimed"` if assignee chosen)
   - `assignee_id` = optional
   - `due_date` = today + 2 days for High, +1 day for Critical, +7 days otherwise
   - `custom_fields.snippet_incident_id` + `custom_fields.snippet_id`
3. Insert a `pm_task_snippets` row tying each new task to the original snippet (so it appears in the snippet's usage footer immediately).
4. Toast: "Created N follow-up tasks across N sites" with "View incident" link → opens the incident drawer (below).
5. Invalidate `["snippet-usage", snippetId]` and `["pm-tasks"]` query keys.

### 4. Showing the relationship — two surfaces

**On the snippet card** (`SnippetCard.tsx`): when `pm_snippet_incidents` has unresolved rows for this snippet, render a small inline banner above the description using existing destructive tokens:

```
⚠ Active incident · 2 of 4 sites fixed · View
```

Click → opens `SnippetIncidentDrawer`.

**On every affected task** (`TaskWorkspace`): when `task.custom_fields.snippet_incident_id` is set, render `IncidentContextBanner` directly above `RequestContextPanel`:

```
Part of broken-snippet incident: "{incident title}"
Snippet: {snippet title} · Sibling sites: site-a ✓, site-b ✓, site-c, site-d
[View incident] [View snippet]
```

Sibling chips use existing `StatusPill` colors (done = green check, others muted).

### 5. The incident drawer — `SnippetIncidentDrawer.tsx`

Lightweight `Sheet` (right side, matches existing drawers):

- Header: snippet title + severity pill + "Mark resolved" button (sets `resolved_at`).
- Description.
- **Affected sites table**: project · assignee avatar · `StatusPill` · due date · click row → opens that task in the workspace (`useTaskDrawerLink().open(taskId)`).
- Progress: "2 of 4 sites fixed" (counts tasks where status ∈ done/approved set).
- "Add another site" secondary action → mini version of the dialog's site picker, creates one more task tied to this incident.

### 6. Incident list

Add an **"Incidents"** tab inside `/snippets` (existing tabs/segmented control). Lists all incidents with snippet, severity, progress, resolved/active filter. Clicking opens the drawer. No new top-level nav route.

## Files

**Migration**
- `pm_snippet_incidents` table + grants + permissive RLS.

**Created**
- `src/lib/pm/snippetIncidents.ts` — types + `createSnippetIncident`, `fetchIncident`, `fetchIncidentsForSnippet`, `fetchAllIncidents`, `resolveIncident`, `addSiteToIncident`, `useIncidentSiblings(taskId)`, `useSnippetActiveIncident(snippetId)`.
- `src/components/pm/snippets/ReportBrokenSnippetDialog.tsx`
- `src/components/pm/snippets/SnippetIncidentDrawer.tsx`
- `src/components/pm/snippets/SnippetIncidentBanner.tsx` (the inline card warning)
- `src/components/pm/snippets/IncidentsList.tsx` (the tab content)
- `src/components/pm/workspace/IncidentContextBanner.tsx`

**Edited**
- `src/components/pm/snippets/SnippetCard.tsx` — dropdown item + active-incident banner.
- `src/pages/pm/Snippets.tsx` — add Incidents tab.
- `src/components/pm/workspace/TaskWorkspace.tsx` — mount `IncidentContextBanner` above `RequestContextPanel` when `custom_fields.snippet_incident_id` present.
- `mem://index.md` — append one Core line describing the incident model.

## Out of scope

- No notifications/email — uses existing `pm_notifications` patterns only if trivial; otherwise deferred.
- No bulk re-assignment after creation — handled per-task in the normal workspace.
- No edits to the snippet's code from the incident flow — fixing the snippet itself happens in the normal editor; the incident only tracks the rollout to each site.
- No new colors, icons system, or layout — reuses `Dialog`, `Sheet`, `StatusPill`, `Checkbox`, `AvatarStack`, destructive/warning tokens already in `index.css`.

## Technical notes

- Reuse the usage query from `SnippetUsageFooter` (extract into `src/lib/pm/snippetUsage.ts` so both the footer and the dialog read it).
- Pick the task `type` carefully: check `src/components/pm/WorkTypeBadge.tsx` for the canonical set — if `"bug"` exists use it; otherwise fall back to `"dev"` and add an `is_incident: true` flag in `custom_fields` so the workspace can still highlight it.
- "Sibling sites" query: `select id, title, status, project_id, pm_projects(title) from pm_tasks where custom_fields->>'snippet_incident_id' = $1`.
- All new queries use `staleTime: 30_000` and emit `emitTasksChanged()` after writes to keep boards in sync.

## Success criteria

- A snippet owner can report a broken snippet, pick affected sites, and produce one individual task per site in a single submit.
- Every generated task appears in normal queues (Board, Work Queue, Workload) with correct priority and assignee.
- Opening any of those tasks shows the incident banner with sibling progress.
- Opening the snippet shows an active-incident banner + per-site progress in the drawer.
- Marking the last task done lets the incident be resolved (or auto-resolves), and the banner goes away.
