Add drag-and-drop, inline status pill, and inline date picker to the **Board view only** of Project Detail → Tasks. List view is untouched.

`pm_tasks.sort_order` already exists, so no DB migration is needed.

### Dependencies
Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (not currently in `package.json`).

### File changes
- Edit `src/components/pm/project/TasksTab.tsx` — replace the board section with a dnd-kit `DndContext`.
- New `src/components/pm/project/board/BoardColumn.tsx` — droppable column wrapper.
- New `src/components/pm/project/board/BoardTaskCard.tsx` — the existing `TaskCard` with new footer + sortable wiring.
- New `src/components/pm/project/board/StatusPickerPopover.tsx` — small popover with 4 group options.

### Group → primary status mapping
```
ready       → "unclaimed"
in_progress → "in_progress"
in_review   → "in_review"
complete    → "complete"
```
When moving a card to a column whose `statuses` already includes the task's current status (e.g. dragging a `blocked` card within "In Progress"), keep the status. Otherwise set to the column's primary status.

### Drag & drop (CHANGE 1)
- `TasksTab` keeps a local `boardTasks` state seeded from `filtered`, used only by the board so optimistic moves are instant.
- `DndContext` with `PointerSensor` + `TouchSensor` (activation distance 6px) + `KeyboardSensor`. Each column wraps its items in `SortableContext` (vertical strategy).
- On `onDragStart`: record `activeId` for the overlay.
- On `onDragOver`: if hovering over a column the active task isn't in, move it locally into that column at the end.
- On `onDragEnd`: compute new column + new index, update local state, then:
  - `supabase.from("pm_tasks").update({ status, sort_order }).eq("id", id)` and re-number sort_order for the affected column(s).
  - On error: revert `boardTasks` to the snapshot taken on drag start, `toast.error("Couldn't move task")`.
- `DragOverlay` renders the card at `opacity-80`; original slot stays in place (sortable shows a translucent placeholder via `useSortable` + `isDragging` → `opacity-40`).
- Column droppable styling while a drag is active and id matches `over.id`: `bg-info/5 border-dashed border-info` (transparent border otherwise to avoid layout shift).

### Inline status pill (CHANGE 2)
- New `StatusPickerPopover` using shadcn `Popover`. Trigger = a small pill: `<span class="text-[10px] uppercase font-medium px-2 py-0.5 rounded-full {colorClasses}">{groupLabel}</span>`.
- Color tokens by group:
  - ready: `bg-muted text-muted-foreground`
  - in_progress: `bg-info/15 text-info`
  - in_review: `bg-warning/15 text-warning`
  - complete: `bg-success/15 text-success`
- Popover content: vertical list of 4 buttons, each with a colored dot (`bg-muted-foreground`, `bg-info`, `bg-warning`, `bg-success`) + label.
- On select: same status-mapping rule, optimistic local update, persist via supabase, toast on failure. Popover closes via `onOpenChange(false)`; outside click + Escape come free with shadcn Popover.
- `e.stopPropagation()` on the pill + popover so dnd-kit doesn't start a drag and the card's own click (open workspace) doesn't fire.

### Inline date picker (CHANGE 3)
- Reuse `DatePicker` from `@/components/ui/date-picker.tsx` directly is overkill (it has its own button styling). Instead use the same `Popover` + `Calendar` primitives:
  - Trigger when date set: `<button class="text-[11px] text-muted-foreground hover:text-foreground">{fmtDate(due_date)}</button>`
  - Trigger when null: `<button class="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"><CalendarIcon h-3 w-3/> Set date</button>`
  - Popover content uses `<Calendar mode="single" selected={…} onSelect={…} className="p-3 pointer-events-auto" />`.
- On select: optimistic update of local `boardTasks`, then `supabase.from("pm_tasks").update({ due_date }).eq("id", id)`, revert + toast on failure. Close popover.
- Wrap trigger in `e.stopPropagation()` so clicking the date doesn't navigate to the workspace and doesn't begin drag.

### Card footer layout
```
┌────────────────────────────────────────────┐
│ Title (line-clamp-2)                       │
│ description preview (line-clamp-2)         │  (existing)
│ [TYPE]                                     │
│                                            │
│ [status pill]      [date]   [avatar]       │
│ subtasks "2/5"  (kept on its own row above │
│                  footer if present, small) │
└────────────────────────────────────────────┘
```
- Footer: `flex items-center justify-between` with left = status pill, right = date + avatar (gap-2).
- Subtasks line stays inline above footer in muted 11px (kept from previous change but moved out of the footer).
- Keep card padding `p-3`, no min-height bump.

### Click vs drag vs inline controls
- Card click (anywhere not on status pill / date trigger) navigates via `onClick` — already exists. Wrap pill + date trigger with `onPointerDown={e => e.stopPropagation()}` and `onClick={e => e.stopPropagation()}` so dnd-kit's listeners (attached to the card wrapper via `useSortable`) and the navigation handler both ignore them.
- The `useSortable` `listeners`/`attributes` are spread on a drag handle area — simplest: spread on the whole card, but the inline controls stop propagation as above. PointerSensor activation distance of 6px prevents accidental drags on click.

### Constants exported
`STATUS_PILL_CLASS: Record<StatusGroupId, string>` and `STATUS_DOT_CLASS: Record<StatusGroupId, string>` defined in `BoardTaskCard.tsx` (or a small `boardStyles.ts`) and reused by `StatusPickerPopover`.

### Files
- New: `src/components/pm/project/board/BoardColumn.tsx`, `BoardTaskCard.tsx`, `StatusPickerPopover.tsx`
- Edited: `src/components/pm/project/TasksTab.tsx`
- Dependency: install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`