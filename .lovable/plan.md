# Consolidate team color definitions into a single canonical source

## Goal
Eliminate duplicate Team → color mappings so there is one source of truth in `src/lib/pm/teams.ts`. Color values stay identical; only definitions are deduplicated.

## Current state
- `src/lib/pm/teams.ts` already exports `TEAM_COLOR: Record<Team, string>` with the canonical HSL values.
- `src/components/pm/project/TasksTab.tsx` duplicates the mapping in two places:
  - An inline `pills` array (lines ~440–446) hardcodes `teamColor` for `design`, `dev`, and `qa`.
  - A `TeamPillInline` helper (lines ~915–929) defines a local `colors` record for all teams.
- `src/lib/pm/projectColor.ts` only handles per-project colors; it has no overlapping team color logic.
- `src/lib/pm/track.ts`, `src/lib/pm/taskVisualState.ts`, `src/components/pm/TeamsMultiSelect.tsx`, and `src/components/pm/collections/TaskListView.tsx` already import `TEAM_COLOR` from `teams.ts`.

## Change
1. **Rename canonical export** in `src/lib/pm/teams.ts`:
   - Rename `TEAM_COLOR` → `TEAM_COLORS` (single exported map per the request).
2. **Update existing consumers** to import `TEAM_COLORS` instead of `TEAM_COLOR`:
   - `src/lib/pm/track.ts`
   - `src/lib/pm/taskVisualState.ts`
   - `src/components/pm/TeamsMultiSelect.tsx`
   - `src/components/pm/collections/TaskListView.tsx`
3. **Deduplicate `TasksTab.tsx`**:
   - In the `pills` array, remove hardcoded `teamColor` values and look up `TEAM_COLORS[p.id]` instead.
   - In `TeamPillInline`, replace the local `colors` record with `TEAM_COLORS[team]`.

No color values will be changed, and no other status/project color logic will be touched.

## Verification
- Run a TypeScript check to confirm no broken imports.
- Visually confirm team pills and chips still render the same colors in the running app.
