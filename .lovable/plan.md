## Goal
Make role separation automatic and visually reinforced — remove the explicit Track toggle and replace it with role-aware defaults, a persistent role badge, role-specific Work Queue sections, role-aware Board columns, and a Tasks-tab role filter inside Project Detail. **Me Mode is preserved as-is** and continues to stack on top of all role-based filtering.

## 1. Replace Track toggle with invisible role-aware filtering

**New hook**: `src/hooks/useTypeFilter.ts`
- State: `types: Set<TaskType>`, persisted per-page in `sessionStorage` keyed by page id + current user role.
- Default initializer reads current user role:
  - `designer` → `{'design'}`
  - `developer` → `{'dev'}`
  - `pm` / `submitter` → all types (empty set = no filter)
- Exposes `{ types, setTypes, isDefault, resetToDefault, showAll }`.

**New component**: `src/components/pm/TypeFilterLabel.tsx`
- Renders next to the chip filter row: `Showing: Design tasks` (or `Dev tasks` / `All task types`).
- Secondary link: `Show all types` (only when filtered) and `Reset` (when expanded back).
- Small muted text — no toggle group.

**Remove**: `TrackToggle` from `CollectionToolbar.tsx`. Drop `showTrack` prop. **Keep** `MeModeToggle` exactly where it is.

**Delete**: `src/components/pm/TrackToggle.tsx`, `src/hooks/useTrackMode.ts`. Keep `userTrack()` helper in `src/lib/pm/track.ts`; remove `applyTaskTrack`.

**Update pages** (`WorkQueue`, `Board`, `GlobalTimeline`, `Workload`, `ProjectDetail`): swap `applyTaskTrack`/`useTrackMode` for `useTypeFilter` + a new `applyTaskTypes(tasks, types)` helper in `src/lib/pm/filters.ts`. **Me Mode filtering (`applyTaskMeMode`, `useMeMode`) stays untouched** — it continues to wrap results after type filtering.

## 2. Role badge in TopBar

Edit `src/components/TopBar.tsx`:
- Add a `<Badge>` next to the user avatar/name, colored by role:
  - PM → dark blue, "Project Manager"
  - Designer → purple, "Designer"
  - Developer → green, "Developer"
  - Submitter → neutral, "Submitter"
- Add HSL tokens `--role-pm`, `--role-designer`, `--role-developer` to `src/index.css` and surface in `tailwind.config.ts`.
- Always visible ≥ md; small colored dot on narrow screens.
- Me Mode toggle in TopBar stays in place.

## 3. Work Queue — role-specific sections

Rewrite the body of `src/pages/pm/WorkQueue.tsx` to render different sections per role. Filter pipeline order: type filter → chip filters → **Me Mode** → section slicing.

**PM** sections:
- *My Projects to Manage* — projects where `created_by === me` OR I'm a member.
- *Approvals Waiting on Me* — `status === 'in_review'` AND (assignee = me OR project member = me).
- *Unclaimed PM Tasks* — `status === 'unclaimed'` AND `type === 'pm'`, with "Show all unclaimed" expander.

**Designer** sections:
- *My Design Work* — `assignee_id === me` AND `type === 'design'` AND not complete/approved.
- *In Review — Needs My Attention* — `type === 'design'` AND `status === 'in_review'` AND (assignee = me OR creator = me).
- *Unclaimed Design Requests* — `status === 'unclaimed'` AND `type === 'design'`; expander → all unclaimed.

**Developer** sections:
- *My Dev Tasks* — assignee + `type === 'dev'` + active.
- *Blocked — Needs Resolution* — `type === 'dev'` AND `status === 'blocked'` (mine first, then others on my projects).
- *Unclaimed Dev Tasks* — same pattern with expander.

Me Mode toggle (existing behavior) further narrows "mine"-style sections to strictly `assignee_id === me`; Unclaimed sections always remain visible because they're inherently not-yet-mine.

Stat tiles recompute against the role-filtered set.

## 4. Board — role-aware default columns

Edit `src/pages/pm/Board.tsx`:
- `DEFAULT_COLUMNS_BY_ROLE`:
  - designer: `['unclaimed','claimed','in_progress','in_review','complete']` (blocked + approved → header count badges).
  - developer: `['in_progress','blocked','in_review','complete']` (unclaimed → small badge).
  - pm / submitter: all 7 statuses.
- Persist override in `localStorage` key `pm.boardColumns.<role>`.
- "Columns" popover (multi-select + Reset) in toolbar `actions` slot.
- Hidden-status counts shown as compact clickable badges above the board.
- Type filter from §1 + existing Me Mode both still apply to which cards render.

## 5. Project Detail — Tasks tab role filtering

Edit `src/pages/pm/ProjectDetail.tsx` Tasks tab.

- Quick-filter pill row above the task list: `All | PM | Design | Dev | Review`. Seeded from current user role (designer→Design, developer→Dev, pm→All); state local to the component.
- Filter rules:
  - `All` → no type filter.
  - `PM` → `type === 'pm'`.
  - `Design` → `type === 'design'`.
  - `Dev` → `type === 'dev'`.
  - `Review` → `status === 'in_review'`.
- Visual de-emphasis (instead of hiding) for non-matching role tasks when "All" is selected and the user has a role:
  - Pass `dimPredicate(task)` into `TaskListView` / `TaskGridView`.
  - Apply opacity-60 + slight grayscale on rows where predicate is true.
  - PM never dims anything.
- Me Mode continues to function on this page exactly as today, narrowing the list to assignee = me on top of the role pill filter.
- Gantt chart unaffected — it always shows the full dependency graph.

## Technical Details

**Types** (`src/types/pm.ts`): no schema change. Add `TaskTypeFilter = 'pm' | 'design' | 'dev' | 'review'` for §5.

**No DB migration.** The DB trigger that derives `track` from assignee role stays — `track` becomes UI-irrelevant but harmless.

**Files added**
- `src/hooks/useTypeFilter.ts`
- `src/components/pm/TypeFilterLabel.tsx`
- `src/components/pm/board/ColumnPicker.tsx` (popover for §4)

**Files edited**
- `src/components/TopBar.tsx` — role badge.
- `src/index.css`, `tailwind.config.ts` — role HSL tokens.
- `src/components/pm/CollectionToolbar.tsx` — drop `showTrack`/`TrackToggle`; **leave `MeModeToggle` intact**; mount `<TypeFilterLabel/>` inside the chip row.
- `src/lib/pm/filters.ts` — add `applyTaskTypes`. **`applyTaskMeMode` unchanged.**
- `src/pages/pm/WorkQueue.tsx` — role-specific sections + "Show all unclaimed" expander; Me Mode logic preserved.
- `src/pages/pm/Board.tsx` — role default columns + Columns picker; Me Mode preserved.
- `src/pages/pm/ProjectDetail.tsx` — quick-filter pill row + dimming; Me Mode preserved.
- `src/components/pm/collections/TaskListView.tsx`, `TaskGridView.tsx` — accept optional `dimPredicate`.
- `src/pages/pm/GlobalTimeline.tsx`, `src/pages/pm/Workload.tsx` — swap track filter for type filter; Me Mode preserved.

**Files removed**
- `src/components/pm/TrackToggle.tsx`
- `src/hooks/useTrackMode.ts`

## Out of scope
- Changing or removing Me Mode behavior anywhere.
- Renaming/refactoring DB `track` column.
- Notifications, top-bar search, Files tab.
