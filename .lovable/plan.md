# Me Mode, Filter Chips & Standardized Toolbar

Three coordinated additions that unify how every PM collection view is filtered and laid out.

## 1. Me Mode (global)

A persistent **Me | All** segmented toggle in the TopBar, visible on every page.

- **State**: `sessionStorage` key `pm.meMode` (`"me"` | `"all"`). Resets when the tab/session ends or user is switched.
- **Default**: `All`.
- **Hotkey**: pressing `M` (when not focused in an input/textarea/contenteditable) toggles.
- **Active state**: when on, the toggle's "Me" side gets the primary fill; a small ring or dot signals "filter active" so it's obvious from anywhere.
- **Hook**: `useMeMode()` → `{ mode, setMode, isMe }`. Subscribes to a tiny event emitter so all views update in sync.

### Per-view behavior (when Me is on)

| View | Effect |
|---|---|
| Work Queue | My Tasks list filtered to me; Unclaimed always shown (label clarifies "Unclaimed — visible to all") |
| Board (kanban/list/grid) | Only cards assigned to me (no role-based fallback) |
| Projects | Only projects where I am a member (`pm_project_members.user_id = me`) or `created_by = me` |
| Team Workload | All cards still render; my row gets a primary ring + subtle highlight; others fade to ~50% opacity |
| Global Timeline | Gantt + task list filtered to my tasks |
| Activity (Project Detail Activity tab + future global feed) | Entries where `user_id = me` OR `task.assignee_id = me` OR payload contains `@me` mention |
| Forms / Templates / Integrations | No effect (toggle still visible but is a no-op; tooltip: "Me mode doesn't apply here") |

## 2. Filter Chip Bar

Below the toolbar on every list/board view: a row of toggleable chips.

Chips: **Assigned to me · Created by me · Watching · Overdue · Due this week · Blocked**

- Multi-select, additive (AND across active chips).
- Independent of Me Mode — both can be active; results are intersection.
- Persisted per-view in `localStorage` (`pm.filters.<viewKey>`), same key style as `useViewMode`.
- Active chip = filled primary; inactive = outline. Right-side "Clear" link appears when ≥1 chip is active.
- Counts (e.g. "Overdue (3)") shown when cheap to compute from already-loaded data.

### Chip predicates (against `PmTask` unless noted)

| Chip | Predicate |
|---|---|
| Assigned to me | `assignee_id === me.id` |
| Created by me | `created_by === me.id` |
| Watching | `pm_task_watchers.user_id === me.id` (new lightweight table — see Tech) |
| Overdue | `due_date && new Date(due_date) < startOfToday && !['complete','approved'].includes(status)` |
| Due this week | `due_date >= today && due_date <= today+7d` |
| Blocked | `status === 'blocked'` |

For Projects view, chips translate where applicable:
- Assigned to me → I am a member
- Created by me → `created_by === me.id`
- Watching → hidden (n/a v1)
- Overdue → `go_live_date < today && status !== 'complete'`
- Due this week → `go_live_date` within 7d
- Blocked → has any task with status `blocked`

## 3. Standardized Toolbar

Every collection view header uses one shared component:

```text
[Page Title + subtitle]  ··········  [Me|All] [Filter ▾] [Sort ▾] [List|Grid]
                                              \________ FilterChipBar (row 2) ________/
```

- New component: `<CollectionToolbar />` accepting `title`, `subtitle`, `actions` (e.g. New Project button), `viewKey`, `mode`, `onModeChange`, `sortOptions`, `filterChips` (which chips to show — some views opt out of, e.g., "Watching"), and a children slot for the chip bar (rendered by the toolbar).
- The **Filter ▾** popover holds advanced filters (project, type, priority, assignee). v1 ships with a minimal popover (project + type) and a "More filters coming" hint — chips cover the common cases.
- The **Sort ▾** dropdown exposes the same sort keys the list view's column headers do (Title, Due, Priority, Status, Updated). It writes to `pm.sort.<viewKey>` so List and Grid views share sort state.
- Page-specific actions (e.g. "New Project") render inside `actions`, placed before the Me|All toggle so the destructive/creation action stays visually anchored to the title block.

Final placement on the right cluster, in order: `[actions] [Me|All] [Filter ▾] [Sort ▾] [List|Grid]`. New Project / New Form etc. live in `actions`.

## Tech outline

New files
- `src/hooks/useMeMode.ts` — sessionStorage + emitter + `M` global hotkey installer
- `src/hooks/useChipFilters.ts` — `(viewKey) => { active: Set<ChipId>, toggle, clear }` persisted to localStorage
- `src/lib/pm/filters.ts` — pure predicate functions: `applyMeMode(items, view, me)`, `applyChips(items, chips, me, watchers)`
- `src/components/pm/MeModeToggle.tsx`
- `src/components/pm/FilterChipBar.tsx`
- `src/components/pm/CollectionToolbar.tsx`
- `src/components/pm/FilterPopover.tsx` (project + type for v1)
- `src/components/pm/SortMenu.tsx`

Edits
- `src/components/TopBar.tsx` — insert `<MeModeToggle />` (left of role switcher) + register `M` hotkey at app root
- `src/pages/pm/WorkQueue.tsx`, `Board.tsx`, `ProjectList.tsx`, `Workload.tsx`, `GlobalTimeline.tsx`, `Forms.tsx` — replace ad-hoc headers with `<CollectionToolbar />` and pipe data through `applyMeMode` + `applyChips`
- `src/pages/pm/ProjectDetail.tsx` Activity tab — apply Me Mode predicate to activity entries
- Sort state shared between `TaskListView` and toolbar Sort menu (lift sort to parent or expose via hook `useTableSort(viewKey)`)

Database
- Add `pm_task_watchers (id, task_id, user_id, created_at)` with permissive RLS (matches existing `pm_*` posture). Bare-bones — UI to add/remove watchers can come later; for now any task the current user is assignee on is considered "watched" as a fallback so the chip isn't empty on day one.
- Add `pm_project_members` if not already present (the Projects-Me-Mode rule needs it). If it exists from earlier migration, reuse; if not, add `(id, project_id, user_id, role_on_project, created_at)`.

Confirm before migration
- Whether to add `pm_task_watchers` now or stub the chip with the fallback predicate (assignee = me).

## Acceptance

- TopBar shows Me|All toggle on every route; pressing `M` toggles; reload preserves session, new tab/session resets to All.
- Toggling Me Mode immediately re-filters every open collection view per the per-view rules.
- Filter chip bar appears under the toolbar on Work Queue, Board, Projects, Workload, Global Timeline. Clicking chips narrows results; clicking again clears.
- All five collection toolbars share identical layout and ordering.
- Sort selection in the toolbar ↔ list view header clicks stay in sync.
- Workload shows me-row highlighted and others dimmed (cards remain interactive).

## Out of scope (v1)

- @mention parser for activity (only `assignee_id`/`user_id` matches in v1; chip still filters to my-task activity)
- Watchers UI on TaskDrawer (table created, surface added later)
- Saved filter presets
- Filter popover advanced fields beyond project + type
