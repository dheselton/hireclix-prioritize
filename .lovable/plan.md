# Mobile-responsive layouts for the core PM surfaces

## What's already there (verified)

Some mobile handling already exists, so this plan only fills the real gaps:

- `FilterChipBar` already uses `touch-scroll-x no-scrollbar` with `min-w-max` — the chip toolbar is already horizontally scrollable. No change needed.
- The Work kanban (`WorkKanban`) and the project board (`TasksTab` kanban) already switch to horizontally snap-scrolling 85vw columns below `md`.
- `BoardTaskCard` already renders a `StatusPickerPopover` on the card, so a mobile status-change control already exists per card.
- `Workload` grid is `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` — it stacks below `md` but is still 2-up between `md` and `lg`.
- `GlobalTimeline` renders the Gantt chart with no mobile alternative — this is the biggest real gap.

## Changes

### 1. Global Timeline mobile fallback (`src/pages/pm/GlobalTimeline.tsx`)
Below `md`, replace the Gantt card with a compact project list: project title, go-live date, status, and a count of visible tasks; each row links to the project. Use `useIsMobile()` to branch so the Gantt is not mounted at all on phones (it renders wide SVG and is unusable). Desktop rendering unchanged.

### 2. Workload stacks below `lg` (`src/pages/pm/Workload.tsx`)
Change the person-card grid to `grid-cols-1 lg:grid-cols-2 xl:grid-cols-3` so cards are a single vertical list on phones and tablets. Tighten card internals slightly on small screens (avatar row and progress bar stay; per-task rows already truncate).

### 3. Project board single-column stack below `md` (`src/components/pm/project/TasksTab.tsx`)
When `useIsMobile()` is true and `view === "kanban"`, skip the `DndContext` entirely and render a stacked list: one section header per status group (label + count, collapsible like the list view) with `BoardTaskCard`s in a single column at full width. Drag-and-drop stays desktop-only; the existing on-card `StatusPickerPopover` handles status changes on mobile. Desktop board markup untouched.

### 4. Work board single-column stack below `md` (`src/pages/pm/Work.tsx` + `src/components/pm/work/WorkKanban.tsx`)
Same approach in `WorkKanban`: when mobile, render stacked per-status sections (header + count, cards full width) instead of the DnD board, and add a small status select on each mobile card that calls the existing `onMove(taskId, status)` handler.

### 5. Toolbar overflow (`src/components/pm/CollectionToolbar.tsx`)
The action row can overflow on narrow screens. Make the actions/controls rows horizontally scrollable on mobile (`touch-scroll-x no-scrollbar` with `flex-nowrap` below `md`, existing `flex-wrap` from `md` up) so Quick Request / Project / Columns buttons stay reachable.

## Out of scope
No desktop layout changes, no visual redesign, no data or permission changes.
