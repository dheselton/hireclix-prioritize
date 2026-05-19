Finish the Work Type polish items left from the previous pass.

## Scope

1. **WorkTypeBadge on remaining collection views**
   - `src/components/pm/collections/TaskGridView.tsx` — render `<WorkTypeBadge>` next to the project name (lookup via `projectsById[task.project_id]?.work_type`).
   - `src/components/pm/collections/ProjectGridView.tsx` — render `<WorkTypeBadge>` in the card header next to the title.

2. **Work-type filter on Board and Global Timeline**
   - Add `<WorkTypeFilterToggle>` (existing) to the toolbar in `src/pages/pm/Board.tsx` and `src/pages/pm/GlobalTimeline.tsx`.
   - Use the existing `useWorkTypeFilter` hook (persisted key per page, e.g. `pm.workType.board`, `pm.workType.timeline`).
   - Filter tasks by joining against `projectsById[task.project_id]?.work_type` before grouping/rendering.

3. **Request card density**
   - In `ProjectWorkCard.tsx` and `ProjectListView.tsx`/`ProjectGridView.tsx`, when `project.work_type === 'request'`:
     - Tighter padding (`p-3` instead of `p-4`), smaller title (`text-sm`), hide description preview, hide phase/timeline meta.
     - Show only: Title · Client · Task count · WorkTypeBadge.
   - Keep Project cards untouched.

4. **Flat-list phase header label**
   - In `ProjectDetail.tsx` Tasks tab, when `work_type === 'request'` and tasks are rendered without phase grouping, suppress the "No phase" header entirely (render tasks directly, no group header).

## Out of scope
- No schema changes, no new routes, no behavior changes beyond visual density + filter wiring.
- Convert flow, creation dialog, and Work Queue sections already shipped — not touched.

## Files to modify
- `src/components/pm/collections/TaskGridView.tsx`
- `src/components/pm/collections/ProjectGridView.tsx`
- `src/components/pm/collections/ProjectListView.tsx`
- `src/components/pm/collections/ProjectWorkCard.tsx`
- `src/pages/pm/Board.tsx`
- `src/pages/pm/GlobalTimeline.tsx`
- `src/pages/pm/ProjectDetail.tsx`
