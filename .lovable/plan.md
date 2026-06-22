## Goal

Designers and developers are one combined production team — they should see each other's tasks by default, not just their own team's. Today the project board's "My team" filter shows only the user's mapped team (designer → design tasks, developer → dev tasks).

## Change

Treat design + dev as a single peer group inside the team filter. QA, strategy, analytics, etc. stay scoped to themselves. PM and submitter continue to bypass the filter.

### `src/lib/pm/teams.ts`
- Add a `TEAM_PEERS: Record<Team, Team[]>` map. Default = `[team]`. Override: `design: ["design","dev"]` and `dev: ["design","dev"]`.

### `src/hooks/useTeamFilter.ts`
- Replace the single-team check in `filterTask` with a peer-set check: a task is in-scope if any of its `teams` is in `TEAM_PEERS[myTeam]`.
- Update the chip label so designers and developers see `"My team (Creative + Dev)"` instead of just `"Design"` / `"Dev"`. Other roles keep their existing single-team label.

### Scope check
- `useTeamFilter` is only consumed by `src/components/pm/project/TasksTab.tsx`, so no other call sites need touching.
- No DB changes — `pm_tasks.teams` already stores the array we filter on.
- Doesn't affect the new project-board "Ready/no-Claimed" + unassigned-glow work from the previous turn.