## Goal

Let templates (and live projects) define which downstream tasks are hidden until prerequisites complete, while supporting parallel/early-visible exceptions for design-build and time tracking. Reuse existing dependency tables — no new dependency model.

## Concept

Add a single `reveal_mode` column to both dependency tables. It controls when the *successor* becomes visible in default task views:

| `reveal_mode` | Successor visible when… | Use case |
|---|---|---|
| `on_complete` (default) | predecessor is `approved`/`complete` | Round 2 hidden until Round 1 done |
| `on_start` | predecessor is `in_progress` or later | Dev can start once design enters working state |
| `always` | immediately, ignore prereq state | Parallel build/track for planning + time tracking |

Existing `finish_start` / `start_start` / `finish_finish` semantics (for scheduler dates) are unchanged. `reveal_mode` is a UI-visibility concern only — it never blocks editing, time tracking, or the Gantt.

## Schema

Single migration:

```sql
ALTER TABLE pm_template_dependencies
  ADD COLUMN reveal_mode text NOT NULL DEFAULT 'on_complete'
  CHECK (reveal_mode IN ('on_complete','on_start','always'));

ALTER TABLE pm_task_dependencies
  ADD COLUMN reveal_mode text NOT NULL DEFAULT 'on_complete'
  CHECK (reveal_mode IN ('on_complete','on_start','always'));
```

Template→project copy in `instantiateTemplateIntoProject` (`src/lib/pm/api.ts`) already copies dependency rows; extend it to carry `reveal_mode` over.

## Visibility helper

New `src/lib/pm/reveal.ts`:

```ts
export type RevealMode = 'on_complete' | 'on_start' | 'always';

// Given tasks + deps, return Set<taskId> of hidden tasks.
export function computeHiddenTaskIds(tasks: PmTask[], deps: PmDependency[]): Set<string>;

// Per-task helper for surface checks.
export function isTaskHidden(task: PmTask, tasks: PmTask[], deps: PmDependency[]): boolean;
```

Rules:
- A task is hidden if it has at least one `pm_task_dependencies` row with `reveal_mode <> 'always'` whose predecessor hasn't reached the required state.
- `on_complete` requires predecessor status ∈ {`approved`, `complete`}.
- `on_start` requires predecessor status ∈ {`in_progress`, `in_review`, `approved`, `complete`}.
- Tasks with no deps are always visible (existing behavior).

## UI integration (reuse current components)

1. **TasksTab** (`src/components/pm/project/TasksTab.tsx`) and the `/pm/work` list/kanban/projects views filter through `computeHiddenTaskIds`. A subtle inline row appears at the bottom of each list/column:
   ```
   <button> + 3 upcoming tasks — show all </button>
   ```
   Toggle persists in `localStorage` per project/view key. No new component family — uses the existing muted-button styling already used by "Show completed".

2. **TaskWorkspace** never hides itself even if hidden — deep links and search always reach a task. A small muted chip in the header says "Upcoming · waiting on {predecessor title}" when hidden, with a tooltip explaining the reveal mode. Uses the existing `Badge` variant.

3. **Time tracking & TimerSearch**: time entry surfaces (TimeTrackerCard, EntryPopover task picker) ignore the hidden flag so anyone can log time against a task that hasn't surfaced yet — addresses the "appear earlier for time tracking" requirement without forcing UI exposure.

4. **Gantt / Workload / Timeline**: always show every task (planning surfaces). Hidden tasks render with reduced opacity + dashed border (already used for proposed dates) so they read as "upcoming". No new tokens.

5. **TemplateBuilder dependency editor** (`src/components/pm/template/...`): on each dependency row add a small `Select` with three options: "Reveal on complete (default)" / "Reveal on start" / "Always visible". Matches the existing dep-type select. Same select appears in the live task dependency editor inside TaskWorkspace.

6. **Task list row indicator**: revealed-but-still-blocked tasks already show the `blocked` status badge — no change. New "upcoming" indicator only on hidden tasks, only when "Show all" is toggled on.

## Files

- New: `src/lib/pm/reveal.ts`, migration `add_reveal_mode_to_dependencies.sql`
- Edited:
  - `src/lib/pm/api.ts` — carry `reveal_mode` in `instantiateTemplateIntoProject`; expose in fetchers; update `PmDependency` / template dep types
  - `src/types/pm.ts` — add `reveal_mode` to dep types
  - `src/components/pm/project/TasksTab.tsx`, `src/pages/pm/Work.tsx` (and ProjectWorkGrid/board renderers) — filter + "show all" toggle
  - `src/pages/pm/TaskWorkspace.tsx` — upcoming badge, reveal-mode select in dep editor
  - `src/components/pm/template/TemplateDependencyEditor.tsx` (or current template dep UI) — reveal-mode select
  - `mem://index.md` — short note: "Dependency `reveal_mode` controls UI visibility only (scheduler unchanged); helper in `src/lib/pm/reveal.ts`; Gantt/Workload/Timesheet always include hidden tasks"

## Out of scope

- Changing scheduler date math (`reveal_mode` is UI-only).
- Auto-claim / auto-assign on reveal.
- Notifications when a task becomes visible (can layer on later).
- Server-side filtering — kept client-side because the same query feeds Gantt/Workload which need all rows.

## Verification

- Template with round1→round2 finish_start + `reveal_mode='on_complete'`: round 2 hidden until round 1 marked complete.
- Same template with a parallel "Dev scaffold" task depending on "Design v1" with `reveal_mode='always'`: visible immediately.
- Hidden task: appears on Gantt + Timesheet picker; TaskWorkspace direct URL works.
- TopBar/sidebar/permissions and existing date-cascade flows unchanged.
