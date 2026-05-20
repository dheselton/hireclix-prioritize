
## Goals

1. Make adding / changing / removing assignees fast from **task cards** (board) and **task rows** (list), with a **bulk "Assign to…"** action on the board.
2. In **All mode**, every role sees every task — no more lane filtering for designers/devs/etc.
3. Make the **Configure Timeline** buttons (Auto-link in order, Recalculate from kickoff, Fit to go-live) actually run and produce visible date changes, with clearer feedback when they no-op.
4. Ship an **in-app Help page** at `/pm/help` with a step-by-step guide: finalize the Career Site template → start a new Career Site project → edit task dates so the rest of the schedule cascades.

Scope is additive — no rebuild of existing screens. Project membership (TeamCard) already works and is unchanged.

---

## 1 — Inline assignee picker

New small component: `src/components/pm/AssigneePopover.tsx`
- Trigger = `UserAvatar` (or "Unassigned" dot) — clicking opens a popover.
- Searchable list of `mock_users`, with role chip on the right.
- "Unassign" button at the bottom when a user is set.
- On select: optimistic update, then `updateTask(id, { assignee_id })`, toast on error + revert.
- `stopPropagation` on the trigger so it doesn't open the workspace.

Wire it into:
- `src/components/pm/project/board/BoardTaskCard.tsx` — replace the bare `UserAvatar` with `AssigneePopover`.
- `src/components/pm/collections/TaskListView.tsx` — same swap on the assignee cell.
- `src/components/pm/project/TasksTab.tsx` list rows (line ~368) — same swap.
- `src/pages/pm/Board.tsx` kanban card — same swap.

**Bulk assign on Board kanban:** extend the existing multi-select pattern in `BulkTaskActions.tsx`. Add an "Assign to…" button that reuses `AssigneePopover` in multi mode and calls `updateTask` for each selected id.

Removal from a project is already in `TeamCard`; no change there.

---

## 2 — Drop lane filter in All mode

Today `WorkQueue.tsx` filters non-PM users to a `ROLE_LANE` allow-list:
```
inLane(t) → only design/content for designers, dev/qa for developers, etc.
```

Change:
- Add a `useMeMode()` read to `WorkQueue.tsx`.
- When `mode === "all"`, `inLane` becomes `() => true` for every role (PM behavior).
- When `mode === "me"`, keep current lane gating (designers still see only their lanes for "their" view).
- Same treatment for `UnclaimedBanner.tsx`: in All mode, count unclaimed across all teams for everyone.

No change to `Board.tsx` (it already uses `applyTaskMeMode` and ignores lanes).

---

## 3 — Fix Configure Timeline panel

`ConfigureTimelinePanel.tsx` exists but the buttons frequently appear to do nothing. Root causes to address:

a. **No diffs returned** when tasks already match the schedule → the cascade modal opens with zero rows and instantly closes, so the user thinks nothing happened. Fix: if `diffs.length === 0`, show a toast "Schedule already up to date" instead of opening the modal.

b. **`recalcFromKickoff` runs but doesn't persist `kickoff_date` on the project** — only updates tasks. Add an `updateProject(project.id, { kickoff_date: kickoff, go_live_date: suggested })` write after apply.

c. **`autoLinkInOrder` silently fails** when `pm_task_dependencies` insert is blocked by missing project_id linkage in some rows. Add per-row `project_id` to the insert payload (FK is via task), and surface the error toast.

d. **Tasks with `null` start/due dates** are skipped by `recalculateForward`. After a successful kickoff recalc, also write the freshly placed `start_date`/`due_date` for tasks that had `null` originally so future drags work.

e. Add a small **"Diagnose timeline"** button in the panel header that lists: # tasks, # tasks with no dates, # dependencies, whether kickoff is set — purely informational so the user can self-debug.

No changes to scheduler math itself.

---

## 4 — In-app Help page

New route `/pm/help`:
- File: `src/pages/pm/Help.tsx`
- Sidebar link in `AppSidebar.tsx` ("Help", `BookOpen` icon, visible to all roles).
- Content: Markdown rendered with `react-markdown` (already a transitive dep — verify; otherwise render with prose-classed JSX directly).

Sections (written as numbered checklists with screenshot-free, action-oriented steps that match the actual UI labels):

1. **Finalize the Career Site template**
   - Open Templates → Career Site → Edit.
   - Confirm each phase exists, each task has `duration_days` and a `role`.
   - Lock kickoff-anchored tasks (Kickoff Call) and go-live anchored tasks (Launch) using the lock toggles.
   - Add dependencies in the template builder so each task lists what it depends on.
   - Save.

2. **Start a new Career Site project**
   - Projects → New Project → pick Career Site template → set client + go-live date.
   - This creates the project, copies tasks and dependencies, and seeds dates from the template's `default_go_live_offset_days`.
   - Open the project → Tasks tab → confirm phases and tasks landed.

3. **Set the real schedule**
   - Project header → "Configure Timeline".
   - Enter Kickoff date → "Recalculate from kickoff" → review cascade modal → Apply.
   - Or set both kickoff + go-live → "Fit to window" to compress flexible tasks.
   - If "Schedule already up to date" appears, dates are already valid.

4. **Edit one task and let the rest move**
   - Project → Timeline (Gantt) → drag a task's bar OR open the task workspace and change Start/Due dates.
   - The Cascade Confirm modal shows every downstream task that will shift; Apply writes them all.
   - Critical path is highlighted in red on the Gantt.

5. **Add / remove people**
   - Project Overview → Team card → "Add" to invite a workspace user with a project role; "✕" to remove.
   - On any task card or row, click the avatar to assign/unassign inline.
   - On the Board, select multiple cards → "Assign to…" for bulk reassignment.

6. **All mode vs Me mode**
   - Top bar toggle. In **All** mode every user sees every project and task across teams. In **Me** mode, the view narrows to your assignments and projects.

---

## Files

**New**
- `src/components/pm/AssigneePopover.tsx`
- `src/pages/pm/Help.tsx`

**Modified**
- `src/components/pm/project/board/BoardTaskCard.tsx`
- `src/components/pm/collections/TaskListView.tsx`
- `src/components/pm/collections/BulkTaskActions.tsx`
- `src/components/pm/project/TasksTab.tsx`
- `src/pages/pm/Board.tsx`
- `src/pages/pm/WorkQueue.tsx`
- `src/components/pm/UnclaimedBanner.tsx`
- `src/components/pm/ConfigureTimelinePanel.tsx`
- `src/components/AppSidebar.tsx`
- `src/App.tsx` (route)

**DB:** none. Schema already supports everything.

---

## Out of scope

- Real admin role on `mock_users` (current PM role + "All mode" = admin behavior).
- Auth changes.
- Reworking the scheduler algorithms.
- Per-task assignment from the Gantt bars.
