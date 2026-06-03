## Mental model to land

Everything is a **project**. A **Quick Request** creates a lightweight, single-purpose project (1–3 tasks, no timeline). A **Full Project** is a multi-phase project (timeline, dependencies, page groups). The Work view shows them side by side and lets you filter between the two.

No data model changes — `pm_projects.work_type` (`"request" | "project"`) stays as the source of truth. Only labels, helper text, tooltips, and empty states change.

## Copy changes

### 1. `WorkTypeFilterToggle` (src/components/pm/WorkTypeFilterToggle.tsx)
- Relabel: `All` → **All work**, `Requests` → **Quick requests**, `Projects` → **Full projects**.
- Add a `title` tooltip on each button: "All work across the team", "Lightweight, single-task projects", "Multi-task projects with a timeline".

### 2. `CreateWorkDialog` (src/components/pm/CreateWorkDialog.tsx)
Selector cards on the "Create new work" step:
- **Quick Request** card subtitle → "A lightweight project for small, fast work (1–3 tasks, no timeline)."
- **Full Project** card subtitle → "A multi-phase project with timeline, dependencies, and page groups."
- Dialog titles: keep "New Quick Request" and rename "New Full Project" header copy stays as is. Add one-line helper under each step's title:
  - Quick Request: "Creates a lightweight project — same home as full projects, just simpler."
  - Full Project: "Plan multi-phase work with a timeline and dependencies."

### 3. `WorkTypeBadge` (src/components/pm/WorkTypeBadge.tsx)
- Label `"Request"` → **"Quick"**, `"Project"` → **"Full"** (keeps badge narrow). Add `title` tooltip "Quick request — lightweight project" / "Full project — multi-phase work".

### 4. Work page (src/pages/pm/Work.tsx)
- Subtitle for `list` mode → "Every project across the team — quick requests and full projects."
- Subtitle for `projects` mode → "All projects with active work. Quick requests show as compact cards."
- Button label `Quick Request` stays; tooltip on `Quick Request` button → "Lightweight project (1–3 tasks)". Tooltip on `Project` button → "Multi-phase project with timeline".

### 5. Daily Briefing column header (src/components/pm/workqueue/QuickTasksColumn.tsx, src/pages/pm/WorkQueue.tsx)
- Section header "Quick Tasks" → keep, add one-line helper "Single-task work from quick requests."
- "Project Work" column helper → "Tasks from multi-phase projects."

### 6. Empty states (collections)
- `TaskListView` "No tasks." → "No work here yet."
- `TaskGridView` same → "No work here yet."
- `ProjectGridView` / `ProjectListView` "No projects yet." → "No projects yet. Start a Quick Request or Full Project to get going."
- `ProjectWorkGrid` "No work here." → "Nothing matches these filters."

### 7. ProjectHeader (src/components/pm/project/ProjectHeader.tsx)
- Where a `work_type === "request"` project is shown, render the `WorkTypeBadge` with its new tooltip; no other copy change.

## Files touched

- `src/components/pm/WorkTypeFilterToggle.tsx`
- `src/components/pm/WorkTypeBadge.tsx`
- `src/components/pm/CreateWorkDialog.tsx`
- `src/pages/pm/Work.tsx`
- `src/pages/pm/WorkQueue.tsx`
- `src/components/pm/workqueue/QuickTasksColumn.tsx`
- `src/components/pm/collections/TaskListView.tsx`
- `src/components/pm/collections/TaskGridView.tsx`
- `src/components/pm/collections/ProjectGridView.tsx`
- `src/components/pm/collections/ProjectListView.tsx`
- `src/components/pm/collections/ProjectWorkGrid.tsx`
- `src/components/pm/project/ProjectHeader.tsx` (only if badge needs tooltip wiring)

## Not changing

- Database columns, enum values, API payloads, route paths.
- Visual styling, spacing, icons, component variants.
- Behavior of any filter, button, or card.

## Verification

1. Open `/pm/work` → toolbar shows "All work / Quick requests / Full projects"; tooltips appear on hover.
2. Click "Create new work" → both selector cards have the new subtitles; dialog titles unchanged.
3. WorkTypeBadge on a task card reads "Quick" or "Full" with tooltip on hover.
4. Filter to a state with no results → empty state reads new copy.
5. Daily Briefing columns show the new one-line helpers.
