# Team-color left border on every task card

## Problem
The amber left border on **unclaimed** tasks (and the teal/purple bars on Career Site / Internal) currently override the team color bar. So at-a-glance every unclaimed Design task looks identical to every unclaimed Dev task — the team color only shows inside the small pill.

The user wants the most prominent visual cue — the left bar — to communicate **team(s)** first.

## Fix

### 1. Team bar always wins on `pm_tasks` cards
Update `BoardTaskCard`, `ProjectTaskCard`, `RequestTaskCard`:
- Remove the `!unclaimed` exclusion from `showTeamBar`. Whenever the task has team tags, the left bar renders the team color (or diagonal stripes for multi-team).
- Drop the `unclaimed && border-l-4 border-l-amber-500` rule entirely. "Unclaimed" is still clearly communicated by the existing **Unclaimed** pill + Claim CTA.
- Keep the **Career Site (teal)** and **Internal (purple)** left bars as overrides — these are project-level signals (not visible from the team pills) and per the existing precedence rule in memory. They get a thin team-colored *dot* in the top-right of the bar area? No — keep it simple: career site / internal bars stay as-is for now; team is still visible via the pill.

### 2. Multi-team clarity
`teamBarBackground()` already returns diagonal stripes for multi-team. Bump stripe width from 6px → 8px so two-team cards (e.g. Design + PM) read clearly at a glance instead of looking like a fuzzy gradient.

### 3. Waiting state preserved
When `vis.waiting` is true the bar already renders dimmed via the `dim` prop on `TeamColorBar`. No change.

### 4. List + grid views
`TaskListView` rows get the same treatment: a 4px team-colored left edge on the row (currently they only show team pills). Same precedence (careersite > internal > team).

## Files to edit
- `src/components/pm/project/board/BoardTaskCard.tsx`
- `src/components/pm/collections/ProjectTaskCard.tsx`
- `src/components/pm/collections/RequestTaskCard.tsx`
- `src/components/pm/collections/TaskListView.tsx`
- `src/lib/pm/taskVisualState.ts` (stripe width tweak)

No DB / type / API changes.

## Result
Every card's left edge instantly tells you which team(s) own it. Unclaimed status is still obvious (pill + Claim button) but no longer drowns out the team signal.
