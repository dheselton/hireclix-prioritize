# Project Detail Redesign

Rebuild `src/pages/pm/ProjectDetail.tsx` to match the spec exactly, while reusing existing data (`fetchProject`, `fetchTasks`, etc.), the scheduler/cascade modal, `FilesTab`, `TaskDrawer`, and `useCurrentUser`/`useMockUsers`.

## 1. New project header (always visible)

Replace current Card-based header with a flat header block:
- **Breadcrumb**: `Projects / [Client Name]` — small muted text. Client name from `clients` table via `project.client_id` (extend `fetchProject` callsite to also fetch client, or one-shot supabase select).
- **Title row**: 20px / font-medium project title + inline badges:
  - Status badge (color-mapped: active→success, on_hold→warning, complete→muted, etc.)
  - Type badge (muted)
- **Right cluster**:
  - Overlapping avatar stack (top 3 team members from `pm_project_members`, `-ml-1.5` with `ring-2 ring-background`)
  - `Add Task` outline button (opens existing TaskDrawer in create mode OR jumps to Tasks tab with inline add)
  - `Share` primary button (wires to a simple "copy URL" toast for now — no new backend)

## 2. KPI strip

Single horizontal row directly under header, items separated by spacing only:
- Go-live: label + bold `fmtDate(go_live_date)`
- Progress: label + bold `pct%`
- Overdue: count in `text-destructive` (tasks past `due_date` & not complete)
- Blocked: count in `text-warning` (`status === "blocked"`)
- Open: muted (status not in complete/approved)

## 3. Tab bar (4 tabs)

Custom tab bar (not shadcn Tabs default styling) with active tab using `text-info` + 2px `border-info` bottom border:
- **Overview | Tasks | Timeline | Files**
- Drop Activity / Forms / Integrations tabs from this page (the latter two already link out; activity feed moves into Overview "Start Here" callouts + can be re-surfaced later if needed). Comments/activity feed code stays in the file but is unrendered to avoid losing it — or extracted to a small `ProjectActivityPanel` component for future use.
- Tasks is the **default active** tab (changed from current Overview default).
- Tab switching = local state, same route.

## 4. Overview tab

Two-column grid `grid-cols-[1.3fr_1fr] gap-4`:

**Left:**
1. **Start Here** card (`bg-secondary`):
   - Uppercase muted label "Start Here"
   - 2–3 callout rows derived from data:
     - Warning border-l-[3px] `border-warning`: next upcoming milestone (kickoff/client review/go-live within 7 days)
     - Danger border `border-destructive`: "{N} overdue tasks" → links via `buildQueueLink` to filtered Work Queue
     - Info border `border-info`: "Waiting on client review" if any `in_review` tasks
   - Each row wraps `<Link>` per the clickable-callouts memory rule.
2. **Brief** card (`bg-secondary`) — keep existing `RichTextEditor` wired to `project.description`.

**Right:**
1. Metric grid `grid-cols-3 gap-2` — three `bg-secondary` mini cards: Progress %, Open tasks, Done tasks. Small label + large number (`text-2xl font-semibold`).
2. **Key Dates** card (`bg-secondary`): rows Kickoff / Client Review / Go-Live. Label left, `fmtDate` right. Client Review row in `text-warning` if within 5 days. Keep date pickers as compact inline editors (PM only).

Request-type projects keep the existing "Request details" card above this grid (no spec change there).

## 5. Tasks tab (default)

### Toolbar
- Left: filter chips `All | Design | Dev | QA | My Tasks`. Active chip: `bg-info/10 text-info border-info`.
- Right: `List | Board` view toggle (same chip styling). Persist per-user via existing `useViewMode("project.tasks", ...)`.

`My Tasks` chip wires to `useMeMode` (no longer a default-by-role pill).

### List view — grouped by status, not phase
Groups: **Ready (`unclaimed`/`ready`)**, **In Progress (`claimed`/`in_progress`)**, **In Review (`in_review`)**, **Complete (`complete`/`approved`)**. Remove "Claimed" as a separate visible group (mapped into In Progress).

Each group:
- Collapsible header row: rotating chevron + uppercase 12px label in group color + count pill (`bg-muted`).
- Collapse state stored in `useState` (session-only, persists during navigation within page).

Each task row:
- 3px left bar in group color
- 13px font-medium title, truncated
- Type badge with color map: design→amber, dev→info, qa→success, pm/review/approval→muted
- 24px assignee avatar (reuse `UserAvatar`)
- 11px muted due date
- 8px priority dot: high→destructive, medium→warning, low→muted
- Hover: `hover:border-info`
- Click: row gets `border-info bg-secondary` + opens preview panel (NOT TaskDrawer). Selected task id in local state.

### Task preview panel
- 280px sticky right column appearing only when a task is selected, separated by `border-l`.
- Layout switches to `grid-cols-[1fr_280px]` when open.
- Contents: type badge + close ×, title (15px), short description (muted 13px, truncated), Assignee / Due / Priority rows, full-width primary `Open Full Task ↗` → `useTaskDrawerLink().open(id)` (which already routes to `/pm/tasks/:id`).

### Board view
- 4 columns matching the same status groups.
- Column header: uppercase 12px label in group color + count.
- Card: 12px bold title, type badge, footer row with due date + assignee avatar.
- Click card → same preview panel behavior.
- Reuse a shared `TaskRowCompact` / `TaskCardCompact` component for consistency (replace existing `TaskKanban` usage on this page).

## 6. Timeline tab

Replace existing Gantt embed with placeholder card per spec:
> "Timeline view — tasks plotted against go-live date with locked milestones (Phase 2)"

`bg-secondary` muted card. Existing `GanttChart` component stays in the codebase, just unmounted from this page.

## 7. Files tab

- Intro line (12px muted): "All files attached to this project and its tasks, in one place."
- Update existing `FilesTab.tsx` row styling to: 32px `bg-secondary` icon square with uppercase extension label, filename, right-aligned "Uploaded {date}". Aggregation logic (project + task uploads) already exists — verify and keep.

## 8. New / changed files

**New:**
- `src/components/pm/project/ProjectHeader.tsx` — breadcrumb, title, badges, avatar stack, action buttons.
- `src/components/pm/project/KpiStrip.tsx`
- `src/components/pm/project/ProjectTabs.tsx` — custom underline tab bar.
- `src/components/pm/project/OverviewTab.tsx` (StartHere + Brief + metrics + KeyDates).
- `src/components/pm/project/TasksTab.tsx` (toolbar, list, board, preview panel — replaces in-file `TaskTabContent`).
- `src/components/pm/project/TaskPreviewPanel.tsx`
- `src/components/pm/project/StatusGroup.tsx` + `TaskRowCompact.tsx` + `TaskCardCompact.tsx`
- `src/lib/pm/statusGroups.ts` — group mapping + color tokens.

**Modified:**
- `src/pages/pm/ProjectDetail.tsx` — slim composition shell.
- `src/components/pm/project/FilesTab.tsx` — restyle rows + intro line.

**Untouched logic:** scheduler, CascadeConfirmModal, request-details card, RichTextEditor, TeamCard/ClientCard remain available (TeamCard data reused for avatar stack — extract a small `useProjectTeam(projectId)` hook).

## 9. Constraints honored

- Tabs are conditional render, no new routes.
- Header + KPI always rendered above tabs.
- View toggle persisted via existing `useViewMode` (localStorage-backed).
- Group collapse state session-local.
- Preview panel side-by-side, never replaces list.
- `Open Full Task` uses existing full-workspace nav.
- No new components for board vs list — both consume the same `TaskCardCompact`/`TaskRowCompact` primitives.
- "Claimed" status mapped into "In Progress" group; not shown separately.
- All colors via semantic tokens (`info`, `warning`, `destructive`, `success`, `secondary`, `muted`).
