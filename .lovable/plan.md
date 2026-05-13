## Goal

Across all PM main views (Work Queue, Board, Projects), default to the **Projects** view (project-first cards with inline next-up/resume indicators). Users can still toggle to List, Grid, or Kanban via the existing `ViewToggle`.

## Changes

### 1. `src/pages/pm/ProjectList.tsx` (Projects page)
- Switch default mode from `"grid"` to `"projects"`: `useViewMode("projects", "projects")`.
- Add `"projects"` to the toolbar `modes` array (currently uses default `["list","grid"]`); pass `modes={["projects","list","grid"]}`.
- Render branch: when `mode === "projects"`, render `<ProjectWorkGrid tasks={tasksScopedToVisibleProjects} projects={projectsMap} meId={user?.id ?? null} onOpenTask={drawer.open} />`. Need to add a `TaskDrawer` mount + `useTaskDrawerLink()` here (currently absent) so opening a "next up" task from a project card works. Keep existing `ProjectListView` / `ProjectGridView` for other modes.
- Scope tasks passed to `ProjectWorkGrid` to only those whose `project_id` is in `visible` (so chip/Me-mode filtering on projects still narrows the set). Pass `hideLoose` since the Projects page should not show the "Loose tasks" group (loose tasks belong to Work Queue).

### 2. `src/pages/pm/Board.tsx`
- Replace local `boardMode` useState/localStorage with `useViewMode("board", "projects")` so it integrates with the same default-mode system used elsewhere.
- Extend modes to `["projects","kanban","list","grid"]` in `CollectionToolbar`.
- Add a new render branch: when `mode === "projects"`, render `<ProjectWorkGrid tasks={visible} projects={projById} meId={user?.id ?? null} onOpenTask={drawer.open} onChanged={reload} />`. Hide the Columns popover unless `mode === "kanban"` (already conditional on kanban — keep).
- Subtitle: when projects mode, show "Projects with active work — open a card to drill in."

### 3. `src/pages/pm/WorkQueue.tsx`
- Already defaults to `"projects"` and includes `"projects"` in modes — no change needed beyond confirming behavior. (No edits.)

### 4. `src/hooks/useViewMode.ts`
- No changes — `"projects"` is already a valid `ViewMode`.

### 5. `src/components/pm/ViewToggle.tsx`
- No changes — already renders the `FolderKanban` icon for `"projects"` when included in `modes`.

## Out of scope
- No schema changes.
- No changes to `ProjectWorkCard` / `ProjectWorkGrid` internals.
- No changes to `/pm/workload`, `/pm/timeline`, `/pm/forms`, `/pm/templates`, `/pm/integrations` — those are not card-collection views and don't have a meaningful "projects vs tasks" toggle. (Confirm: the user said "Work Queue, Board, Projects, etc." — interpreting "etc." as "anywhere a list of tasks is presented." If they want it in Workload too, we can extend in a follow-up.)

## Open question
Should the Board page persist mode under the shared default-mode system (`useViewMode`), replacing its bespoke `pm.viewMode.board` storage? Plan above assumes **yes** — this gives users one consistent "set my default view everywhere" behavior. Existing localStorage value migrates implicitly (key happens to match `pm.viewMode.board`).
