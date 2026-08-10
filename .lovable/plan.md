# Milestone view on the project Timeline

Add a second way to read a project timeline: today it only groups tasks week-by-week relative to go-live. Users will be able to toggle between **Weeks** and **Milestones**, where the milestone view mirrors the attached Career Site base timeline sheet.

Also: everywhere the app says "Phase" it will say **Milestone**.

## Toggle

The project's Timeline tab gets a small two-option toggle in its header:

- **Weeks** — the existing week-of / T-minus grouping (unchanged, stays the default).
- **Milestones** — new grouped sheet view.

The choice is remembered per user (localStorage), so returning to a project keeps the last view.

## Milestone view

Modeled on the uploaded sheet: milestone header rows (Project Setup Pre-Kick Off, Kick Off, Discovery, Concept, Design, Build, Technical Setup, GLAAT, Go Live) with their tasks listed beneath in a table.

Each milestone header shows:
- Milestone name
- Rolled-up date range (earliest start → latest end of its tasks)
- Total duration in working days
- Progress (e.g. "6 of 9 done") with a slim progress bar
- Status treatment: complete (muted/checked), in progress (accent), upcoming (quiet)
- Collapsible — click the header to expand/collapse; completed milestones start collapsed

Each task row shows the sheet's columns:
- Task title (click opens the task workspace)
- Duration (days)
- Start date / End date (mm/dd/yyyy, em dash when unset)
- Team (team pills already used elsewhere)
- Assignee avatar
- Status pill
- Description snippet, truncated

Tasks with no milestone fall into an "Unassigned" group at the bottom. On narrow screens the table collapses to stacked cards (title + dates + status) so it stays readable.

Milestones with no tasks still render their header so the plan shape is visible.

Every count and row is clickable: milestone progress counts deep-link to the project board filtered to that milestone; task rows open the task.

## Phase to Milestone rename

UI-facing label only — no database changes, no data migration. Text updated in: project Timeline and Tasks tabs, New Task dialog, Task workspace meta card, task cards, Template Builder, Configure Timeline panel, Timeline Setup Wizard, Pages tab, Work Queue, client portal view, and Help copy.

## Technical notes

- New `src/components/pm/project/MilestoneTimelineView.tsx`; `ProjectTimelineTab.tsx` keeps the week logic and renders whichever view is selected via the existing `useViewMode` hook pattern.
- Milestones read from the already-loaded `pm_project_phases` rows (`phases` state in `ProjectDetail.tsx`, passed down alongside `tasks`); DB tables/columns (`pm_project_phases`, `pm_tasks.phase_id`, `phase_name` on templates) keep their names.
- Duration prefers `duration_days`; roll-ups computed client-side from task `start_date`/`due_date`, using the existing `localDateISO`/`fmtDate` helpers so no UTC drift.
- Team pills reuse `src/lib/pm/teams.ts`; deep links use `buildQueueLink()` with `base: "/pm/projects/:id"`.
- No change to the global `/pm/timeline` Gantt in this pass.

## Not included

Editing milestone names/order from the timeline view, and importing the sample sheet as a template — the sheet is used here only as the layout guide.
