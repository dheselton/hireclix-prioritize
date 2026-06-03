## Problem

The unclaimed banner says "48 unclaimed team tasks" but clicking it leaves you on the Daily Briefing (`/pm`), which ignores `chips=` / `workType=` / `section=` URL params. Same for every hero chip in `DailyBriefingHero` (Quick Tasks, Active Projects, Overdue, Blocked) — they all point to `/pm?chips=…`, which renders the briefing, not a filtered list.

Only `/pm/board` actually consumes those params (via `useChipFilters("board")` + `useWorkTypeFilter("board")`).

## Fix

### 1. Make `buildQueueLink` land on a filterable view

`src/lib/pm/links.ts` — change the default `base` from `/pm` to `/pm/board`. The `chips`, `workType`, and `section` params already match what Board reads on mount, so all existing call sites start working without changing their args.

### 2. Audit & fix non-`buildQueueLink` callouts

- **`UnclaimedBanner`** — already uses `buildQueueLink({ chips: ["unclaimed"] })`; once #1 lands it deep-links to `/pm/board?chips=unclaimed`. Drop `section: "inbox"` (Board has no inbox section).
- **`DailyBriefingHero`** — fine after #1 (Quick Tasks, Active Projects, Overdue, Blocked all become real filtered views).
- **`KpiStrip`** (`src/components/pm/project/KpiStrip.tsx`) — Overdue / Blocked / Open numbers are currently plain text. Wrap each in a `<Link>` to `/pm/board?chips=overdue|blocked` (Open → `chips=` empty, scoped via project? since Board is global, just link to the project's own Tasks tab `/pm/projects/:id`). Specifically:
  - Overdue → `/pm/board?chips=overdue`
  - Blocked → `/pm/board?chips=blocked`
  - Open → `/pm/projects/:id` (in-project)
  - Progress / Go-live stay non-clickable (informational).
- **`OverviewTab` callouts** — the "X overdue tasks" link currently uses `buildQueueLink({ chips: ["overdue"] })` which is global; that's misleading on a project page. Change to `/pm/projects/:id` (keeps the user on the project). Other callouts already link to the project — leave them.
- **`QuickTasksColumn` "View all"** — keep as-is; works correctly after #1 (`/pm/board?chips=assigned_to_me&workType=request&section=quick-hits`).

### 3. Establish the rule in memory

Update `mem://index.md` Core rule from the existing "every CTA, alert/banner, and stat tile must be a deep link" to also state:
- Deep links MUST target a view that honors the filter (today: `/pm/board` for chip/workType filters, `/pm/projects/:id` for project-scoped callouts).
- Stat tiles with a count (overdue, blocked, in-review, unclaimed, etc.) must be clickable.
- "Actionable = important."

## Out of scope

- Adding chip-param support to the Daily Briefing page itself (would duplicate Board). The briefing stays a dashboard; clicks fan out to Board/project views.
- Adding chip-param support to `TasksTab` (project-level chip filtering) — KpiStrip + OverviewTab callouts use Board or project home for now.
- Backfilling chip support into Workload / Timeline views — none of the surfaced callouts target them.

## Verification

1. From `/pm`, click the amber "48 unclaimed team tasks" banner → lands on `/pm/board` with the Unclaimed chip active and the board filtered to those 48.
2. Hero "1 Quick Task" / "2 Active Projects" / "0 Overdue" / Blocked chips each open `/pm/board` with the corresponding chip(s) + workType pre-applied.
3. Open any project → `KpiStrip` Overdue/Blocked are clickable and deep-link to Board with the matching chip; Open links into the project.
4. `OverviewTab` "X overdue tasks" callout opens the project (no longer the global queue).
