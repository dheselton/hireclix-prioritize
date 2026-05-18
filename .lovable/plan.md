## Work Type (Request vs Project) — Plan

### Schema note
`pm_projects.type` already exists but it stores the **category** (`quick_request | career_site | rfp | evp | dev | candidate_experience`). To avoid overloading it, add a **new column** `work_type` with values `request | project`. All existing rows default to `project`. The old `type` field stays untouched.

### 1. Migration
- `ALTER TABLE pm_projects ADD COLUMN work_type text NOT NULL DEFAULT 'project' CHECK (work_type IN ('request','project'))`.
- Backfill: existing rows are already `'project'` via the default.
- Update `PmProject` interface in `src/types/pm.ts` to add `work_type: 'request' | 'project'`.

### 2. Creation flow — type-selection step
Replace the current "New Project" dialog in `src/pages/pm/ProjectList.tsx` with a two-step dialog:
- **Step 1 — Type select:** two large cards: "Quick Request" / "Full Project" (description copy per spec).
- **Step 2a — Request form:** Title (req), Client (req), Description, optional inline task adder (up to 3 quick tasks). Submit → insert `pm_projects` with `work_type='request'`, `type='quick_request'`, `status='active'`, then insert up to 3 `pm_tasks` rows (`status='unclaimed'`, `type='design'` default, `sort_order` 0/10/20). No templates, no dates.
- **Step 2b — Project form:** existing fields (title, client, type category, status, go-live), kickoff date, optional template select. Insert with `work_type='project'`. Template instantiation continues to use existing `createProjectFromTemplate` flow (no change there).

The same dialog is used wherever "New Project" appears today (single source of truth).

### 3. Project Detail behaviour by work_type
Edit `src/pages/pm/ProjectDetail.tsx`:
- Read `project.work_type`. When `'request'`:
  - Hide tabs: **Timeline**. Keep Overview, Tasks, Files, Activity, Forms, Integrations.
  - Tasks tab: render flat list (no phase grouping, no role pills above phase headers), sorted by `created_at`. Reuse existing `TaskListView`/`TaskGridView`.
  - Overview tab: hide Key Dates card (kickoff/start/go-live) and any "Configure timeline" CTA. Keep Brief, Client card, Team card.
  - Add a top-right **"Convert to Project"** button next to the title.
- When `'project'`: no change.

### 4. Convert Request → Project
- Button in Project Detail header (visible only when `work_type='request'`).
- Opens `ConvertToProjectModal` (new component): select template (Select), kickoff date (DatePicker), optional go-live (DatePicker).
- On confirm:
  1. `update pm_projects set work_type='project', kickoff_date, go_live_date, template_id where id=?`.
  2. Run existing template instantiation to insert phases/tasks/dependencies into **this same project** (extend `createProjectFromTemplate` with an `existingProjectId` mode, or extract its task/phase loop into a helper that writes to a given project_id).
  3. Existing request tasks are **preserved as-is at the top level** (no phase_id) — simpler option per spec.
- Log activity `project.converted_to_project` with payload `{ template_id }`.

### 5. Work Queue sections by work_type
Edit the `sections` builder in `src/pages/pm/WorkQueue.tsx`:
- **PM:**
  1. *Unclaimed Requests* — tasks where parent project `work_type='request'` AND `status='unclaimed'`.
  2. *Active Projects* — projects where `work_type='project'` and `status!='complete'` (rendered as a `ProjectWorkGrid` slice; cleanest to keep a task-section list with the parent project grouping already supported).
  3. *My Work* — tasks assigned to me (both types).
  4. Keep *Approvals Waiting on Me* as a 4th section (from prompt 1.3) so PMs don't lose it.
- **Designer / Developer:** replace current sections with:
  1. *Quick Tasks (Requests)* — tasks whose project is a request, assigned to me OR unclaimed.
  2. *Project Work* — tasks whose project is a project, assigned to me.
  3. Keep *In Review — Needs My Attention* / *Blocked — Needs Resolution* (from prompt 1.3).
- **Submitter:** unchanged.

To keep query-layer filtering, fetch `pm_projects` first, build a `projectsByWorkType` lookup, then split tasks in memory.

### 6. Visual differentiation — Work Type badge
New `src/components/pm/WorkTypeBadge.tsx`:
- `request`: small slate/neutral pill, label "Request".
- `project`: indigo (using `--role-pm` token) pill, label "Project".
- Optional `compact` prop for in-card use.

Surface the badge on:
- `ProjectWorkCard.tsx` (Work Queue + Board project cards) — show prominently in header row.
- `TaskListView.tsx` / `TaskGridView.tsx` task rows — small inline badge derived from `projectsById.get(t.project_id)?.work_type`.
- Kanban cards in `Board.tsx` — small badge.
- `ProjectListView.tsx` / `ProjectGridView.tsx` rows.
- Project Detail header.

Card density tweaks in `ProjectWorkCard.tsx`:
- Request cards: tighter padding (`p-2.5`), show Title · Client · Task count. Hide phase/progress bar.
- Project cards: existing density, show Title · Client · phase/progress + go-live hint when present.

### 7. Filter chip — All / Requests / Projects
- Extend `useChipFilters` (`src/hooks/useChipFilters.ts`) with two new chip ids: `requests_only`, `projects_only` (mutually exclusive — selecting one clears the other).
- Add a small segmented control directly in `FilterChipBar` (or alongside it) that maps to those chip ids. Visible on Work Queue, Board, Global Timeline, and the Projects list.
- Filter logic: in `applyTaskChips` and `applyProjectChips`, join against `projectsById` (passed in) to drop items whose parent doesn't match. Pass `projectsById` from each caller.

### 8. Backwards compatibility
- Default `'project'` keeps every existing record intact.
- Old `pm_projects.type='quick_request'` rows are **not** automatically promoted to `work_type='request'` — keep ambiguity out. (Open question below.)
- All existing pages render identically until they encounter a row with `work_type='request'`.

### Files touched
- **Migration**: `pm_projects.work_type` column.
- `src/types/pm.ts` — add field + `WORK_TYPES` const.
- `src/lib/pm/api.ts` — `createProject` accepts `work_type`; new `convertRequestToProject(projectId, templateId, kickoff, goLive)` helper that reuses template instantiation.
- `src/pages/pm/ProjectList.tsx` — new two-step "Create" dialog.
- `src/pages/pm/ProjectDetail.tsx` — conditional tabs/cards + Convert button.
- `src/components/pm/ConvertToProjectModal.tsx` — new.
- `src/components/pm/WorkTypeBadge.tsx` — new.
- `src/pages/pm/WorkQueue.tsx` — new section logic.
- `src/components/pm/collections/ProjectWorkCard.tsx`, `TaskListView.tsx`, `TaskGridView.tsx`, `ProjectListView.tsx`, `ProjectGridView.tsx`, `Board.tsx` kanban cell — wire badges.
- `src/hooks/useChipFilters.ts` + `src/components/pm/FilterChipBar.tsx` + `src/lib/pm/filters.ts` — Requests/Projects chip wiring.

### Open questions
1. **Existing `type='quick_request'` rows** — should they be auto-promoted to `work_type='request'` in the backfill, or stay as `'project'` (status quo)? Spec says "default to 'project' for all existing records", so my default is the latter — confirm.
2. **Request-task preservation on convert** — spec offers two options. I'm going with "leave them top-level" (no phase). Switch to "Phase 0: Initial Request" if you'd rather.
3. **Inline task adder on Request creation** — task `type` defaults to `design`. Acceptable, or should the form let the submitter pick (design/dev/content)?
