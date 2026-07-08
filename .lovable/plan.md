## Mobile UX Audit & Overhaul

Goal: make the PM app genuinely usable on phones (≤768px). Today it's a desktop-first app — sidebar, dense tables, wide toolbars, task workspace 2-col grid, timeline/gantt, timesheet grid all break or overflow on mobile. This plan is a systematic pass, not a one-off tweak.

### Audit findings (by severity)

**Critical — blocks usage on mobile**
1. **Sidebar**: `AppSidebar` uses `collapsible="icon"` — on mobile it should switch to offcanvas via `SidebarTrigger`. Trigger not visible on mobile in most pages; header layouts assume desktop.
2. **TopBar**: role switcher, search, notifications, user chip all in one row → overflow / cramped on 375px.
3. **TaskWorkspace** (`/pm/tasks/:id`): sticky header row has Back + breadcrumb + 5 action buttons (Timer, Pin, Watch, Quick edit, Delete) — wraps badly. Body grid is `1fr / 300px` which stacks (good), but right rail cards + left cards create very long scroll with no anchoring.
4. **CollectionToolbar** on `/pm/work`, `/pm/projects`, `/pm/time`, `/pm/timeline`: title + mode toggle + chip bar + filters + actions in one flex row → horizontal overflow.
5. **Gantt / Timeline** (`GanttChart`): fixed-width SVG, no horizontal scroll container styling for touch, task list below is a table.
6. **TimesheetGrid** (`/pm/time`): 7-day columns × N tasks — unreadable <900px.
7. **Kanban** (`TaskKanban`, `WorkKanban`, project board): columns side-by-side, no horizontal snap-scroll on mobile.
8. **Dialogs** (`CreateWorkDialog`, `NewTaskDialog`, `EditProjectDialog`, `SnippetEditorDialog`, etc.): shadcn Dialog defaults to fixed max-width; content overflows on 375px, footers with multiple buttons wrap awkwardly.
9. **Task cards** (Board/Project/Request): tap targets on inline popovers (status, priority, assignee) are <44px; hover-only affordances invisible on touch.
10. **Daily Briefing** (`/pm`): Hero + 2-column (Quick Tasks / Project Work) + Notes → stacks vertically but each column card still assumes desktop padding.

**Warning — degrades experience**
11. `FloatingTimerTray` fixed bottom-right at `min-w-[280px]` collides with mobile safe-area + covers content; no bottom-safe-area padding.
12. `TaskDrawer` (quick edit) is a right-side Sheet — on mobile should be bottom sheet or full-screen.
13. `GlobalSearch` cmd-k modal fine, but trigger in TopBar hidden on mobile.
14. `h-screen` usage instead of `h-dvh` in a few full-height layouts (mobile browser chrome cuts content).
15. Filter chip bars wrap into 3+ rows; no horizontal scroll pattern.
16. Rich text editors, code blocks (snippets) overflow horizontally with no scroll container.
17. Attachment preview modal: full-screen on mobile fine, but close button too small.
18. Tables in `ProjectListView`, `TimeEntriesList`, `TaskListView` don't collapse to cards on mobile.

**Info — polish**
19. Tap targets on icon-only buttons (many `size="icon"` at 36×36) below WCAG 44×44.
20. Safe-area insets not respected (notch, home indicator).
21. Form inputs sometimes trigger iOS zoom (font-size <16px on inputs).
22. No pull-to-refresh or momentum-scroll hints; overscroll-behavior not set.

### Fix plan (phased, all UI/presentation only)

**Phase 1 — App shell & navigation** (biggest impact)
- `src/App.tsx` / layout: ensure `SidebarProvider` renders `SidebarTrigger` in a persistent mobile header row. Wrap main in `h-dvh` where currently `h-screen`.
- `AppSidebar`: on mobile, rely on offcanvas Sheet (shadcn `Sidebar` already supports via `useIsMobile`). Verify + tune content padding for touch (44px row targets).
- `TopBar`: collapse to compact mobile layout — hamburger (SidebarTrigger) + logo + search icon + notifications + avatar. Move role switcher into a dropdown behind the avatar on mobile.
- Add safe-area padding utilities (`pb-[env(safe-area-inset-bottom)]`) to fixed elements.

**Phase 2 — CollectionToolbar & filter chips** (used on 6+ pages)
- `CollectionToolbar`: mobile layout = stacked rows. Row 1: title + primary action. Row 2: mode toggle (icon-only). Row 3: chip bar in a horizontally scrollable strip (`overflow-x-auto snap-x` + `no-scrollbar`).
- `FilterChipBar`: add horizontal scroll on mobile, `min-w-max` inner.

**Phase 3 — TaskWorkspace** (`/pm/tasks/:id`)
- Header: on mobile, put actions in an overflow menu (⋯) — keep only Back + Timer visible; Pin/Watch/Quick-edit/Delete go into DropdownMenu.
- Body: already stacks; add tabbed navigation on mobile (Overview / Files / Comments / Meta) to avoid ultra-long scroll. Desktop keeps 2-col.
- Title input: increase font-size to 16px+ min to avoid iOS zoom.

**Phase 4 — Data-heavy views**
- `GanttChart`: wrap in `overflow-x-auto touch-pan-x` container; add sticky first column (task name) if feasible.
- `TimesheetGrid`: on mobile, switch to single-day view with a day-picker (reuse `WeekPaginator` pattern) instead of 7-col grid.
- `TaskKanban` / `WorkKanban` / project board: horizontal snap-scroll on mobile (`snap-x snap-mandatory`, each column `snap-center w-[85vw]`).
- `ProjectListView` / `TaskListView` / `TimeEntriesList` tables: on `useIsMobile()`, render card layout instead of table rows.

**Phase 5 — Dialogs, drawers, popovers**
- Wrap large dialogs (`CreateWorkDialog`, `NewTaskDialog`, `EditProjectDialog`, `SnippetEditorDialog`, `TemplateBuilder` edits, `AddPageDialog`) so on mobile they use `max-w-[100vw] h-dvh` or convert to shadcn `Drawer` (bottom sheet). Prefer a shared `<ResponsiveDialog>` wrapper that renders `Dialog` on desktop, `Drawer` on mobile.
- `TaskDrawer`: on mobile, render as bottom `Drawer` full-height (90vh) instead of right Sheet.
- Ensure Dialog headers include `DialogTitle` + `DialogDescription` (also fixes existing a11y console errors).

**Phase 6 — Touch targets & polish**
- Bump `size="icon"` buttons to `min-h-11 min-w-11` on primary actions (status pill, priority flag, assignee chip, inline date picker).
- `FloatingTimerTray`: add `pb-[env(safe-area-inset-bottom)]`, shrink to `max-w-[calc(100vw-2rem)]`, ensure it doesn't cover FABs.
- Inputs: base font-size 16px on mobile (Tailwind `text-base md:text-sm` pattern) to prevent iOS zoom.
- Replace remaining `h-screen` with `h-dvh` (Briefing hero, auth pages, etc.).
- Add `overscroll-behavior-y: contain` on scrollable panes to stop parent scroll chaining.

**Phase 7 — Daily Briefing (`/pm`)**
- Verify hero stat tiles wrap to 2×2 on mobile (not 4-across squeezed).
- Quick Tasks + Project Work + Notes stack cleanly with reduced padding (`p-3 md:p-6`).

### Technical notes
- Breakpoint helper: `useIsMobile()` already exists (`<768px`).
- Prefer Tailwind responsive prefixes over JS branching where possible; use `useIsMobile()` only when rendering fundamentally different components (Dialog vs Drawer, table vs cards).
- shadcn `Drawer` (Vaul) already available via components/ui; if missing, add.
- No backend changes. No data-model changes. No new routes.
- All work in components under `src/components/pm/**`, `src/components/AppSidebar.tsx`, `src/components/TopBar.tsx`, `src/pages/pm/**` layout wrappers.

### Deliverable order (each phase independently shippable)
1. Shell + TopBar + Sidebar mobile (Phase 1)
2. Toolbar + chip scroll (Phase 2)
3. TaskWorkspace mobile (Phase 3)
4. Responsive dialogs + TaskDrawer bottom sheet (Phase 5)
5. Data views (Gantt/Timesheet/Kanban/Tables) (Phase 4)
6. Polish pass — tap targets, safe-area, iOS zoom, h-dvh (Phase 6)
7. Briefing tune-up (Phase 7)

Estimated scope: ~25–35 file edits across the app, one new shared `ResponsiveDialog` component, no migrations.
