# List / Grid View Toggle Across PM Collection Views

Add a consistent List | Grid toggle to every PM screen that renders a collection. Each view remembers its own preference, persisted per-user via localStorage.

## Scope (views getting the toggle)

| View | Default | Notes |
|---|---|---|
| Work Queue (`/pm`) — Unclaimed + My Tasks | List | Two collections on one page; share one toggle |
| Board (`/pm/board`) | (Kanban stays default) | Add a third mode: Kanban / List / Grid |
| Projects (`/pm/projects`) | Grid | Currently list-only |
| Team Workload (`/pm/workload`) — per-person task lists | List | Toggle controls the inner task lists, not the user cards |
| Global Timeline (`/pm/timeline`) — task list under the Gantt | List | Gantt always visible; toggle only the list below |
| Forms submissions (`/pm/forms/:id` submissions tab) | Grid | |
| Search results (when added) | List | Hook in same component |

## Shared building blocks (new)

```text
src/components/pm/
  ViewToggle.tsx         // List | Grid segmented control (lucide: List, LayoutGrid)
  collections/
    TaskListView.tsx     // sortable table, checkbox bulk-select, inline status
    TaskGridView.tsx     // responsive card grid (3/2/1)
    ProjectListView.tsx  // sortable table (extracted from ProjectList.tsx)
    ProjectGridView.tsx  // card grid w/ progress bar
    SubmissionListView.tsx
    SubmissionGridView.tsx
src/hooks/
  useViewMode.ts         // ('list'|'grid', setMode) keyed by viewKey, persisted
src/lib/pm/
  bulkActions.ts         // reassign / change status / archive helpers
```

### `useViewMode(viewKey, default)`
- Reads `localStorage["pm.viewMode." + viewKey]`
- Falls back to provided default
- Writes on change
- `viewKey` examples: `workQueue`, `board`, `projects`, `workload`, `globalTimeline`, `formSubmissions:<formId>`

### `<ViewToggle value onChange />`
- Top-right of each view's header row
- Two icon buttons (List, LayoutGrid) in a segmented control styled with existing tokens
- Tooltips: "List view" / "Grid view"

## Per-view shape

**List view (tasks)** — columns: checkbox · Title · Client · Type · Status (click to change inline) · Assignee · Due · Priority dot. Click column header to sort (asc/desc). Bulk action bar appears when ≥1 row checked: Reassign, Change Status, Archive.

**Grid view (tasks)** — responsive `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`. Card shows: type+priority badges, title, client/project, status pill, assignee avatar, due date. Hover reveals Claim / Open / Reassign quick actions (absolute-positioned overlay).

**List view (projects)** — keep existing table shape, add sortable headers + checkboxes.

**Grid view (projects)** — card per project: title, client, type tag, status badge, member avatars, go-live date, progress bar (existing % calc).

**Submissions** — list = compact rows (submitted_at, submitter, status); grid = cards with first-field preview.

## Per-screen edits

- **WorkQueue.tsx** — wrap Unclaimed + My Tasks lists in `TaskListView` / `TaskGridView`; toggle in header.
- **Board.tsx** — header gains 3-way mode switch: Kanban | List | Grid. Kanban keeps existing implementation.
- **ProjectList.tsx** — extract current table into `ProjectListView`; add `ProjectGridView`; default Grid.
- **Workload.tsx** — keep user cards; inside each card, the inner task list switches between compact list and small card stack based on the page-level toggle.
- **GlobalTimeline.tsx** — under the Gantt, render the task collection in chosen mode.
- **Forms.tsx / form detail submissions tab** — add toggle, default Grid.

## Bulk actions (list view only)
- Selected IDs held in local state
- Floating action bar above the table
- Reassign → opens existing assignee picker dialog
- Change Status → status select
- Archive → soft-flag (adds `archived_at`; field added in a tiny migration if not present — confirm before adding)

## Out of scope for this pass
- Saved filters / per-column filters
- Drag reordering in list view
- Server-side pagination (current data volumes are small)
- Search results screen itself (toggle hook will be ready when search is built)

## Acceptance
- Every listed view shows the toggle in its top-right.
- Switching toggles the rendered component immediately; reload restores choice per view.
- Preference is independent per view (Projects can be Grid while Work Queue stays List).
- List columns sort on header click; bulk actions work on checked rows.
- Grid cards reveal Claim/Open/Reassign on hover.
