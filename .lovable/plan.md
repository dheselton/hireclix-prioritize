## Goal

One sidebar entry — **Work** — that answers "who claimed this? has this started? what's unclaimed? what's in progress?" across quick tasks and project work, with intuitive filtering between the two.

## Navigation & routing

- Sidebar: replace the two entries **Board** and **Projects** with one entry **Work** (`/pm/work`), icon `LayoutGrid`. Order stays where Board sits today.
- New route `/pm/work` renders the merged page.
- `/pm/board` and `/pm/projects` become `<Navigate to="/pm/work" replace />` so existing deep links (including `buildQueueLink()` which defaults to `/pm/board`) keep working.
- Update `buildQueueLink()` default base to `/pm/work`; keep `/pm/board` accepted as input.
- Update the "Core" memory line that names the nav set to read "Work" instead of "Board, Projects".

## The Work page (`src/pages/pm/Work.tsx`)

Built by consolidating today's `Board.tsx` and `ProjectList.tsx`. Same `CollectionToolbar`, same chip filters, same `WorkTypeFilterToggle`, same `UnclaimedBanner`, same `CreateWorkDialog` Quick Request / Project actions from ProjectList.

**Header**
- Title: `Work`
- Subtitle adapts to current mode (same pattern as Board today).
- Right side actions: `WorkTypeFilterToggle` (All / Quick tasks / Projects), `Quick Request`, `Project` (hidden for submitter, matching ProjectList).

**View modes** (segmented control in toolbar, persisted via `useViewMode("work", ...)`):
1. **All** *(new default)* — flat task list across every project, columns: Title · Project · Type · Status badge · Priority flag · Assignees (MultiAssigneeChip) · Due. Reuses `TaskListView`, with an added "Project" column already supported there. This is the "see everything" answer.
2. **Projects** — existing `ProjectWorkGrid` (project cards with nested tasks).
3. **Kanban** — existing kanban columns + Columns popover from Board.
4. **Grid** — existing `TaskGridView`.

The Work-type toggle is the primary axis for "quick tasks vs larger projects":
- `all` → everything
- `quick` → tasks whose project `work_type === "quick"`
- `project` → tasks whose project `work_type === "project"`

Already implemented in both pages today; we keep that hook unchanged and just expose it in every mode (Projects mode filters projects, the other three filter tasks — matching current behavior).

**Filters retained as-is**
- `useChipFilters("work")` (rename the storage key from "board"/"projects" with a one-time migration that reads either old key on first load).
- Me mode toggle.
- Type filter (`useTypeFilter("work")`).

## Files

- `src/pages/pm/Work.tsx` — new, ~90% lifted from `Board.tsx` with the `mode="all"` default and the Quick Request/Project actions from ProjectList.
- `src/App.tsx` — add `/pm/work` route, change `/pm/board` and `/pm/projects` to redirects, drop unused `Board`/`ProjectList` imports (files stay on disk for now in case of regressions, but no route renders them).
- `src/components/AppSidebar.tsx` — collapse the two items into one `{ title: "Work", url: "/pm/work", icon: LayoutGrid, key: "work" }`.
- `src/lib/pm/links.ts` — `buildQueueLink()` default base → `/pm/work`; accept legacy values.
- `src/hooks/useChipFilters.ts` / `useViewMode.ts` / `useTypeFilter.ts` / `useWorkTypeFilter.ts` — add a tiny read-fallback so `"work"` keys inherit from `"board"` (preferred) or `"projects"` on first load, then write under `"work"`.
- Memory: update the Core line listing nav items.

## What stays the same

- Status model, priority flag, multi-assignee chip — all already consistent from tasks 1–3.
- `/pm` Daily Briefing, `/pm/projects/:id` detail, `/pm/workload`, `/pm/time`, `/pm/timeline`, Forms, Templates, Snippets, Integrations — untouched.
- `CreateWorkDialog`, intake flow, attachments, RLS, scheduler — untouched.

## Verification

After build:
1. Sidebar shows a single **Work** item; clicking it lands on `/pm/work` in **All** mode with every task listed (title, project, status badge, priority flag, assignee stack, due date).
2. Toggling `WorkTypeFilterToggle` between All / Quick / Projects filters in place.
3. Switching to **Projects** / **Kanban** / **Grid** modes shows today's Board/ProjectList equivalents.
4. Visiting `/pm/board` or `/pm/projects` directly redirects to `/pm/work`.
5. A deep link from the Daily Briefing (e.g. unclaimed callout via `buildQueueLink({ chips: ["unclaimed"] })`) lands on Work with the chip applied and the right tasks shown.
