## Goal

Surface task priority at a glance with a small colored flag icon (with tooltip) on every task card and the task detail header, without disturbing existing layouts.

## Component

New `src/components/pm/PriorityFlag.tsx`:
- Renders a `Flag` icon from `lucide-react` wrapped in shadcn `Tooltip`.
- Color via `text-*` classes mapped to existing semantic tokens:
  - `low` → `text-muted-foreground` (subtle gray)
  - `medium` → `text-warning` (orange)
  - `high` → `text-orange-500` *(or `text-warning` darker)* — actually map `high` → `text-warning` and `medium` → a softer amber via existing token. Final mapping:
    - `low` → `text-muted-foreground/60`
    - `medium` → `text-warning` (orange, per request)
    - `high` → `text-warning` filled
    - `urgent` → `text-destructive` filled (red, per request)
- Sizes via prop: `xs` (h-3 w-3) for dense cards, `sm` (h-3.5 w-3.5) default, `md` (h-4 w-4) for detail header.
- `filled` boolean for high/urgent (sets `fill-current` so the flag is solid).
- Tooltip label: `"Priority: <Capitalized>"`.
- Returns `null` when priority is missing/`low` if `hideLow` prop set (default true for cards to avoid noise — confirm in question? No — keep simple: always render, low is dim).

Single source of truth — replaces ad-hoc dot in `ProjectTaskCard` and the unstyled `Badge` text in other cards.

## Where to add it

Insert inline next to the existing title or meta row, no layout changes:

1. `src/components/pm/collections/ProjectTaskCard.tsx` — replace the existing `PRIORITY_DOT` span (~L87) with `<PriorityFlag priority={task.priority} size="xs" />`.
2. `src/components/pm/collections/RequestTaskCard.tsx` — add to header row near type pill.
3. `src/components/pm/collections/ProjectWorkCard.tsx` — add next to title.
4. `src/components/pm/project/board/BoardTaskCard.tsx` — add next to title.
5. `src/components/pm/workqueue/QuickTasksColumn.tsx` (TaskRow) — add inline before/after title.
6. `src/components/pm/workqueue/BlockedTaskCard.tsx` — add to header.
7. `src/components/pm/workqueue/TaskListByType.tsx` — add inline per row.
8. `src/components/pm/collections/TaskListView.tsx` / `TaskGridView.tsx` — add inline (these power the global Board / Workload list views).
9. `src/pages/pm/TaskWorkspace.tsx` header — render `<PriorityFlag size="md" />` next to the track color dot at L142–147.
10. `src/components/pm/workspace/ControlPanel.tsx` — keep the existing priority pill `Select` (it's the editor), but adjacent — no change needed; the flag in the header is the at-a-glance signal.

## Out of scope

- Changing the priority editor / Select trigger styling.
- Adding `urgent` highlighting to card borders (could be a follow-up if requested).
- Sorting / filtering by priority (already supported via existing chips).

## Verification

- Open `/pm`, `/pm/board`, a project page, and a task page. Confirm a colored flag is visible on each card and on the task detail header.
- Hover the flag → tooltip shows `Priority: Urgent` etc.
- Switch a task's priority via the existing pill — the flag updates everywhere on next refetch.
- No card layout shifts; spacing matches surrounding meta chips.
