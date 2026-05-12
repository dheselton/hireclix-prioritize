## Date Dependency Engine — Career Site Timeline

Rebuild the project-creation and timeline logic around **kickoff-first scheduling** with **locked vs flexible** tasks, plus a built-in Career Site template and configuration UI.

---

### 1. Database changes (migration)

Add fields to support locking and minimums on both templates and live tasks:

- `pm_template_tasks`: add `locked boolean default false`, `min_duration_days int`, `parallel_with_temp_id text` (for parallel tasks), `locked_to_kickoff boolean default false`, `locked_to_go_live boolean default false`.
- `pm_tasks`: add `locked boolean default false`, `min_duration_days int`, `locked_to_kickoff boolean default false`, `locked_to_go_live boolean default false`.
- `pm_projects`: add `kickoff_date date` (separate from existing `start_date`/`go_live_date`).

Seed a built-in **"Career Site"** template (`pm_project_templates` + `pm_template_tasks` + `pm_template_dependencies`) with the 5 phases / ~20 tasks listed in the request, with correct `locked`, `min_duration_days`, `duration_days`, `phase_name`, `assignee_role`, and finish-start dependencies between sequential tasks (parallel tasks share the same predecessor).

---

### 2. Scheduler engine (`src/lib/pm/scheduler.ts`)

Add three new pure functions alongside the existing ones:

- `scheduleForwardFromKickoff(kickoff, tasks, deps)` → assigns every task `start/end` walking forward from kickoff, respecting dependencies and durations. Returns `{ diffs, suggestedGoLive }`.
- `fitToWindow(kickoff, goLive, tasks, deps)` → the core "compress flexible, preserve locked" algorithm:
  1. Compute critical-path length using `min_duration_days` for locked tasks and `duration_days` for flexible.
  2. If window < min length → return `{ diffs: [], warning: { earliestGoLive, offendingTasks[] } }`.
  3. Otherwise distribute slack: keep locked tasks at `min_duration_days`, scale flexible tasks proportionally (`flex_dur * slackRatio`, never below 1 day), then forward-schedule from kickoff.
- `validateSchedule(tasks)` → returns per-task flags: `atMinimum`, `belowRecommended`, used by Gantt for amber warnings/tooltips.

Existing `recalculateForward` / `recalculateBackwardFromGoLive` / `computeCriticalPath` stay as-is and continue to feed `CascadeConfirmModal`.

---

### 3. Template instantiation rewrite (`TemplateBuilder.tsx` + new wizard)

Replace the current one-click "Create Project" button with a **3-step wizard** (`src/components/pm/TimelineSetupWizard.tsx`, used from Templates list and Template Builder):

```text
Step 1  Kickoff date           [date picker — mm/dd/yyyy]
Step 2  Suggested go-live      [auto-calculated, read-only]
        Or choose your own:    [date picker]
        ⚠ inline warning if window too tight, with earliest-allowed date
Step 3  Mini Gantt preview     phases grouped, 🔒 on locked bars
        [Confirm & Create]
```

On confirm: insert `pm_projects` row (kickoff_date + go_live_date), insert all `pm_tasks` with computed `start_date`/`due_date`/`locked`/`min_duration_days`, then insert `pm_task_dependencies` from template deps (mapping `temp_id` → real task id).

Template Builder gets two new columns per row: **Locked** (checkbox, 🔒) and **Min days** (numeric, only when locked).

---

### 4. Per-project Configure Timeline panel

New component `src/components/pm/ConfigureTimelinePanel.tsx`, opened from a **"Configure Timeline"** button on `ProjectDetail` (PM only via `useMeMode`/role check):

- Lists all tasks grouped by phase.
- Locked tasks: 🔒 + min duration shown; "Unlock" toggle with confirm warning.
- Flexible tasks: editable duration input.
- Editable kickoff_date and go_live_date at the top.
- Two action buttons:
  - **Recalculate from Kickoff** → `scheduleForwardFromKickoff` → produces new go-live suggestion.
  - **Recalculate from Go-Live** → `fitToWindow` → compresses flexible to fit.
- All resulting diffs go through the existing `CascadeConfirmModal` before being written.

---

### 5. Gantt visual indicators (`src/components/pm/GanttChart.tsx`)

- Locked bars: render an SVG `<pattern>` with diagonal lines as fill, plus a small 🔒 glyph at the left edge.
- At-minimum locked bars: hover tooltip "Minimum duration — cannot compress further".
- Below-recommended flexible bars (flagged by `validateSchedule`): amber stroke + warning icon.
- Critical-path bars keep the existing bold border.

---

### 6. Files to add / modify

**New**
- `src/components/pm/TimelineSetupWizard.tsx`
- `src/components/pm/ConfigureTimelinePanel.tsx`
- `supabase/migrations/<ts>_timeline_engine.sql` (schema + Career Site seed)

**Modified**
- `src/lib/pm/scheduler.ts` — add forward-from-kickoff, fit-to-window, validateSchedule
- `src/lib/pm/api.ts` — helpers `createProjectFromTemplate(templateId, kickoff, goLive)` and `applyScheduleDiffs(diffs)`
- `src/pages/pm/Templates.tsx` — "Use template" opens the wizard
- `src/pages/pm/TemplateBuilder.tsx` — Locked + Min days columns; "Create Project" opens wizard
- `src/pages/pm/ProjectDetail.tsx` — "Configure Timeline" button + panel mount
- `src/components/pm/GanttChart.tsx` — locked pattern, 🔒 icon, amber warnings, tooltips
- `src/types/pm.ts` — extend `PmTask` and `PmTemplateTask` types with `locked`, `min_duration_days`

---

### Open questions before I build

1. **Working days vs calendar days** — should locked minimums and flexible compression skip weekends, or treat every duration as calendar days like today's scheduler does?
2. **Built-in Career Site template** — overwrite if one already exists with that name, or always insert a fresh copy and let you delete duplicates?
3. **"Unlock" on a per-project task** — should unlocking persist only for that project (overrides template), and should re-running the wizard ever re-lock it?