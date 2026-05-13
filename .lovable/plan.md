## Goal

Make tasks land in the right team's queue, make unclaimed work impossible to miss, and support shared design+dev tasks via linked sub-tasks. Then seed the 3 fake requests so you can see it in action.

---

## 1. Teams model

Today every task has a `track` of `pm` or `production`. We expand that so each task belongs to one of four **teams**, each with its own Work Queue lane:

| Team | Task types | Who claims |
|---|---|---|
| **Creative** (existing) | design, content, dev, qa, review, approval | designers + developers |
| **PM** (existing) | review, approval | PMs |
| **Strategy** (new) | strategy, research | strategists |
| **Analytics** (new) | analytics, reporting | analysts |

Schema changes:
- Add `'strategy' \| 'analytics'` to the `track` enum (it's currently a free text column, so just expand the trigger logic + TS union).
- Add new task types: `strategy`, `research`, `analytics`, `reporting`.
- Add new mock_users roles: `strategist`, `analyst` (so the role switcher can preview these queues).
- Update `pm_set_task_track_from_assignee` trigger so a strategist assignee → track=strategy, analyst → track=analytics.

Routing rule (auto-derived, no manual track-picking):
- Task type → default track (design/content → creative, dev/qa → creative, strategy/research → strategy, analytics/reporting → analytics, review/approval → pm).
- Assignee role overrides type when it conflicts.

---

## 2. Work Queue & Board separation

`/pm/queue` and `/pm/board` already filter by the current user's role lane. We extend `ROLE_LANE` so:
- `designer` / `developer` → see Creative team tasks only (design, dev, content, qa).
- `strategist` → strategy + research.
- `analyst` → analytics + reporting.
- `pm` → sees everything (with a team filter chip to narrow).

Add a **team chip filter** to the toolbar so a PM can switch between "Creative", "Strategy", "Analytics", "PM" views. Persist the choice per page in localStorage like the existing view modes.

---

## 3. Unclaimed prominence (banner + badge + card highlight)

Three reinforcing signals:

**A. Sidebar nav badge** — `AppSidebar` shows a pulsing red dot + count next to "Work Queue" whenever there are unclaimed tasks in *this user's team lane*. Live-updates via the existing `useTasksChanged` hook.

**B. Top-of-page banner** — On Work Queue, Board, and Project Detail, show a sticky banner at the top when unclaimed-in-lane > 0:
> ⚡ **3 unclaimed creative tasks** waiting for someone to grab them. [View →]

Dismissible per session, but reappears when the count grows.

**C. Card highlighting** — Unclaimed task cards/rows get:
- A bright accent left border (using `--primary` or a new `--unclaimed` token).
- A prominent "Claim" button right on the card (one click → assigns to current user, status → claimed).
- A faint background tint so they read as a distinct group inside any kanban column or list.

All three derive from the same predicate (`status === 'unclaimed' && inLane(task)`) so they can never disagree.

---

## 4. Shared tasks: parent + linked sub-tasks

For work like "Job Feed Filter Fix" where design and dev happen in parallel:

- Create a **parent task** (type: `coordination`, track: `pm`) that owns the overall scope, dates, and client-facing status.
- Create **child sub-tasks** for each discipline (one `design`, one `dev`), each independently claimable, assignable, and statusable.
- Parent rolls up child status: parent is "in_progress" while any child is active, "complete" when all children complete.
- TaskDrawer shows children inline with claim buttons; child drawer shows a "Parent: ..." backlink.

Schema: add `parent_task_id uuid` (nullable, self-FK) on `pm_tasks`. Existing `pm_subtasks` table is for lightweight checklists — keep it as-is and add this richer parent/child relationship for cross-team coordination.

A "Split into design + dev" quick action on any task creates the two children in one click.

---

## 5. Where tasks come from

No code change needed today — just confirming the routing works for all three sources:
- **Form submissions** (`pm_form_submissions` → `created_task_id`): forms get a "default task type" field so the resulting task lands in the right team queue.
- **Manual creation** (TaskDrawer / Project Detail): type picker drives default track; assignee role overrides.
- **API / webhook** (future): same rules apply server-side via the existing trigger.

---

## 6. Seed the 3 fake requests

Add 1–2 realistic tasks per project:

- **Banner Update — Q2 Hiring Push**
  - 1 design task: "Design Q2 banner creative" (unclaimed, designer lane)
- **Meta Ad Creative — June Campaign**
  - 1 design task: "Design 4 carousel creatives" (unclaimed)
  - 1 design task: "Revisions round 1" (unclaimed, depends on first, lag 2 days)
- **Job Feed Filter Fix** (shared)
  - 1 parent coordination task: "Fix remote-jobs filter persistence"
    - Child design: "Design filter UI states" (unclaimed)
    - Child dev: "Fix filter persistence on reload" (unclaimed, depends on design)

All start unclaimed so you can immediately see the banner, sidebar badge, and highlighted cards working across roles.

---

## Technical notes

**Files touched**
- Schema: migration adds `parent_task_id`, expands track + type enums, seeds new mock_users.
- `src/types/pm.ts`: extend `Track`, `TaskType`, `PmRole` unions; add `parent_task_id` to `PmTask`.
- `src/lib/pm/track.ts`: routing rules (type→track, role→track, assignee override).
- `src/pages/pm/WorkQueue.tsx`: extend `ROLE_LANE`, add team chip for PMs.
- `src/pages/pm/Board.tsx`: same team-aware filtering.
- `src/components/AppSidebar.tsx`: unclaimed badge with pulse animation.
- New `src/components/pm/UnclaimedBanner.tsx`: sticky banner used by Queue/Board/ProjectDetail.
- `src/components/pm/collections/TaskListView.tsx` + `TaskGridView.tsx` + `TaskKanban.tsx`: unclaimed accent border + Claim button.
- `src/components/pm/TaskDrawer.tsx`: parent/child UI, "Split into design + dev" quick action.
- `src/index.css`: `--unclaimed` accent token + pulse keyframe.

**Out of scope**
- Re-enabling auth (still off per project memory).
- Backfilling `track` on existing tasks beyond what the trigger sets on next update.
- Approval workflows for the new Strategy/Analytics teams (use existing review/approval pattern when needed).
