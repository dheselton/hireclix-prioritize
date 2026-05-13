## The problem

"My Design Work" (and the parallel sections for Dev/PM/Strategy/Analytics) currently lists every active task assigned to the user as its own card. Once projects mature, that becomes hundreds of near-identical cards with no project context — overwhelming and hard to prioritize. Users actually think in projects ("how is Resideo doing?") and only need to see the 1–3 tasks per project that are due now or up next, plus a quick way to resume whatever they had open last.

## The shift

**Project is always the primary unit. Tasks live inside projects.** Every main view in `/pm/*` follows a project > task hierarchy:
- Work Queue → role-scoped project cards with inline task indicators.
- Projects → project cards (already project-first; gets the same "my next up" block).
- Board → grouped by project, then tasks within.
- Workload / Timeline → unchanged (those are intentionally cross-project task-level analyses, not "my work" surfaces).

Task-only flat views remain available behind a view toggle for power users, but are never the default.

## New project card anatomy ("My work on this project")

```text
┌────────────────────────────────────────────────────────┐
│ Career Site — Resideo                    ● on track    │
│ Client: Resideo · Go-live 06/12/2026                   │
│                                                        │
│ ▶ Pick up where you left off                           │
│   Wireframes — edited 2h ago             [Resume]      │
│                                                        │
│ My next up (3 of 7)                                    │
│  ⬤ 1 overdue  · ⬤ 2 due this week  · ⬤ 4 upcoming      │
│                                                        │
│  • Design Concepts — Round 3        due 04/02  [Open]  │
│  • Final Figma Handoff              due 04/01  [Open]  │
│  • Gray Components Catalogue        due 04/08  [Open]  │
│                                                        │
│  [+ 4 more]               [Open project] [View all 7]  │
└────────────────────────────────────────────────────────┘
```

### "Pick up where you left off"
- Shows the single most recently touched task by the current user on this project.
- Source of truth: a lightweight `pm_task_activity` signal — last task the user opened in the drawer, commented on, status-changed, or claimed. Stored as `(user_id, task_id, project_id, last_touched_at)` with one row per user per task; we only need the most recent per project.
- If the resume task is also in the "next up" list, it's still pinned at the top in this band and **suppressed** from the "next up" rows below to avoid duplication.
- Hidden if the user has never touched a task in this project.

### "My next up" rules
- Filter project tasks down to the role's lane AND assigned-to-me (or unclaimed for the unclaimed section).
- Sort: overdue → due this week → soonest due → no-date.
- Top 3 only; rest collapses behind "+ N more".
- Status dots summarize the rest: overdue / due-this-week / upcoming / blocked.
- Project header shows health (on track / at risk / overdue) computed from the user's slice — keeps the signal personal.

## Section restructure on Work Queue

Per role, replace the flat task list with two layers:

1. **Project cards** (default) — one card per project that has at least one task in the user's slice. Grouped by health: At risk first (overdue/blocked), then On track, then Idle.
2. **Loose tasks** (collapsed by default) — tasks with no project (the seeded one-off requests). Always visible because they're the "where do these land?" cases.

Unclaimed stays its own section but also flips to project-grouped cards, with a "Loose unclaimed" group at the top so project-less requests remain highly visible.

A view toggle at the top of each section lets power users switch back to flat **List / Grid / Kanban** (existing components).

## Indicators inside the project card

- `●` red — overdue count
- `●` amber — due in next 7 days
- `●` slate — upcoming
- `●` violet — blocked
- Pulsing amber dot on the card if the project has an unclaimed task in the user's lane (mirrors sidebar).
- Critical-path tasks get a thin left accent on the inline row (reuses existing styling).

## Behavior

- Click project title or "Open project" → existing ProjectDetail.
- Click a task row, "Open", or "Resume" → existing TaskDrawer.
- "View all N" expands the card in place to show every task in the slice.
- Card collapse/expand state persists per-project in localStorage.
- Top-of-page counts (My active / Unclaimed / Overdue / Blocked) stay as-is.

## Where else this pattern applies

- **ProjectList page** — embed the same "Pick up where you left off" + "My next up" block in each project card.
- **Board** — already grouped, ensure project headers carry the same health dot + "my work" count chip; tasks inside are unchanged.
- **ProjectDetail** unchanged — that's the deep view.
- **Workload, Timeline, Forms, Templates, Integrations** unchanged.

## Technical notes

Schema (single small migration):
- `pm_task_activity` table: `id`, `user_id` (uuid, mock_users for now), `task_id` (fk pm_tasks), `project_id` (fk pm_projects, nullable), `last_touched_at` (timestamptz default now()), unique `(user_id, task_id)`. Permissive RLS to match other `pm_` tables.
- Trigger on `pm_tasks` UPDATE/INSERT records activity for the actor when available; otherwise the client writes activity from the drawer/claim/status actions.

New components:
- `src/components/pm/collections/ProjectWorkCard.tsx` — `{ project, tasks, role, meId, lastResumeTask, onOpenTask, onOpenProject }`. Pure presentation; computes counts and top-3.
- `src/components/pm/collections/ProjectWorkGrid.tsx` — groups incoming tasks by `project_id`, splits loose tasks, sorts groups by health, renders `ProjectWorkCard`s + Loose block.
- `src/lib/pm/activity.ts` — `recordTaskActivity(taskId)` and `getLastResumeByProject(userId)` helpers.

Edits:
- `src/pages/pm/WorkQueue.tsx` — each role section renders `<ProjectWorkGrid>` by default; toggle adds `"projects"` mode alongside existing `list | grid | kanban`.
- `src/hooks/useViewMode.ts` — extend allowed modes (string-typed).
- `src/pages/pm/ProjectList.tsx` — embed the resume + next-up block in each card.
- `src/pages/pm/Board.tsx` — add health dot + "my work" count chip on project group headers.
- `src/components/pm/TaskDrawer.tsx` + `ClaimButton.tsx` + status change handlers — call `recordTaskActivity` on open/claim/status change.
- `src/index.css` — small `.health-dot-*` utilities on existing tokens; no new colors.

Out of scope:
- No changes to claiming logic, scheduler, cascade modal, or task drawer internals.
- PM "Approvals waiting on me" stays flat (action-oriented, already short). Tell me if you'd rather project-group approvals too.
