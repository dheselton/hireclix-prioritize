## Goal

Make it instantly obvious — at a glance — (a) **which team owns a task** and (b) **whether a task is ready to be worked on now or is waiting on something upstream**. Keep it calm, not noisy.

---

## Part 1 — Team color system

Today every card uses the same orange `type` badge regardless of team, so "All" vs "Design" look identical. We'll move the visual identity from the task `type` to the task `teams[]` (already in DB).

### Left border = team color (the dominant cue)

Each card gets a 4px left border in the team's color. Status of the border:

- **Single-team task** → solid color of that team (e.g. Design = purple, Dev = green, QA = yellow, PM = blue, Strategy = indigo, Analytics = teal, CSM = pink, Support = orange).
- **Multi-team task** → diagonal **striped gradient** of both team colors (CSS `repeating-linear-gradient`), so a Design+Dev task is unmistakably "mixed" without reading text.
- **Unclaimed** still wins on amber when relevant (precedence: careersite > internal > team-color > unclaimed-amber → revise to: careersite > internal > unclaimed-amber > team-color), so the existing amber "grab me" signal isn't lost.

### Team pills replace the lone TYPE badge

On every card (`BoardTaskCard`, `TaskRow`, `ProjectTaskCard`, `RequestTaskCard`):

- Drop the standalone uppercase TYPE pill.
- Render one small `TeamPill` per team in `task.teams[]` (component already exists in `TeamsMultiSelect.tsx`).
- Keep `type` as a tiny muted label next to the title (e.g. "· design mock-up"), so type info isn't lost but isn't competing.

### Filter chips get the same color

The All / Design / Dev / QA / My Tasks chips above the board pick up a left dot in the team color so the active filter visually matches the cards it surfaces. "All" stays neutral. This fixes the "All vs Design look identical" problem.

### Column headers (Board)

`READY / IN PROGRESS / IN REVIEW / COMPLETE` get a thin top accent bar tinted by the **dominant team in that column** when a single-team filter is active — subtle, but reinforces "you are looking at Design work right now."

---

## Part 2 — "Not ready yet" greyed state

We already have `reveal_mode` on dependencies and a hidden-upcoming toggle, but hidden ≠ visible-but-muted. We'll add a third visual state: **dimmed / waiting**.

### Definition

A task is **waiting** if any of:

1. It has an unmet predecessor dependency (any `reveal_mode`), OR
2. Its `start_date` is more than **7 days** in the future AND it has no in-progress work logged.

PMs and the assignee always see them; for everyone else they fall under the same upcoming toggle that already exists.

### Visual treatment for waiting tasks

- Card background → `bg-muted/30`, text → `text-muted-foreground`.
- Team-color left border drops to **30% opacity** + dashed instead of solid.
- Title is normal weight (not bold).
- Small lock-clock icon + tooltip: **"Waiting on: {predecessor title}"** or **"Starts {date}"**.
- Status pill replaced by a neutral `WAITING` chip.
- Hover/click still works; clicking opens the task as normal but the workspace shows the existing `UpcomingBanner` at the top.

### Board column behavior

Waiting cards sink to the bottom of the READY column under a thin divider labeled **"Upcoming · N"** (collapsible, remembers per-project per-user, same `localStorage` pattern as the team filter). Active cards stay on top so the user's eye lands on what to do *now*.

### List view

Waiting rows get the dimmed treatment and a left "⏳ Waiting on …" subline. Same divider/collapse.

---

## Part 3 — Legend / education

One-time inline legend popover on the Tasks toolbar (`?` icon next to the team-filter chips) showing the team color key + the waiting state. Dismissible, stored per user.

---

## Files to touch

**New**
- `src/lib/pm/taskVisualState.ts` — `computeTaskVisualState(task, deps, tasks)` → `{ waiting: boolean, waitingReason: string|null, teamColors: string[] }`. Single source of truth.
- `src/components/pm/TeamColorBar.tsx` — renders solid / striped left border given `Team[]` + dim flag.
- `src/components/pm/WaitingChip.tsx` — neutral pill with clock icon + tooltip.
- `src/components/pm/TaskLegendPopover.tsx` — color key.

**Edited**
- `src/components/pm/project/board/BoardTaskCard.tsx` — swap TYPE badge for `TeamPill`s, use `TeamColorBar`, apply waiting styles, show `WaitingChip`.
- `src/components/pm/collections/ProjectTaskCard.tsx`, `RequestTaskCard.tsx`, `TaskListView.tsx`, `TaskGridView.tsx` — same treatment.
- `src/components/pm/project/board/BoardColumn.tsx` — Upcoming divider + collapse; column-header team accent.
- `src/components/pm/project/TasksTab.tsx` — color the team filter chips, mount `TaskLegendPopover`, pass waiting partition to column.
- `src/lib/pm/teams.ts` — add `teamStripeBackground(teams: Team[])` helper.
- `src/lib/pm/reveal.ts` — extend with `isWaiting()` predicate (re-uses `firstUnmetPredecessor` + start-date rule).
- `src/index.css` — `.team-border-solid`, `.team-border-striped`, `.task-waiting` utility classes (HSL tokens only, no hardcoded colors in components).

**Not changing**
- DB schema, scheduler, time tracking, permissions, RLS.
- The existing hidden-upcoming toggle stays; "waiting" is the *visible-but-dimmed* tier between hidden and active.

---

## Open questions before I build

1. **Multi-team border style** — diagonal stripes of both colors (my recommendation, very legible) vs split-half border vs gradient fade. OK with stripes?
2. **Waiting threshold** — I'm proposing **7 days in the future + no predecessor** counts as waiting. Too aggressive? Prefer 3 / 14 / "only dependency-blocked counts, ignore future start dates"?
3. **Assignee override** — if a task is waiting but assigned to *me*, should it still dim, or always render active for the assignee? (My default: always active for the assignee + PM.)
