
## Goal

Every task carries a set of **teams** (Design, Dev, PM, QA, Strategy, Analytics, CSM, Help/Support). A team member opening a project sees only tasks tagged with their team by default, with a clearly-labeled toggle to reveal everything. PMs always see all. Multi-team tasks show up for each team involved.

## 1. Roles & teams

Add three new login roles + matching teams.

- `PmRole` extended: `pm | designer | developer | qa | strategist | analyst | csm | support | submitter`
- New `Team` enum (single source of truth): `design | dev | pm | qa | strategy | analytics | csm | support`
- `ROLE_TO_TEAM` map (role → its primary team)
- `DEFAULT_TEAMS_FOR_TYPE` map (used to auto-seed `teams` when none chosen):
  - design→[design], content→[design], dev→[dev], qa→[qa], review→[pm], approval→[pm], strategy→[strategy], research→[strategy], analytics→[analytics], reporting→[analytics]

PM continues to bypass every team filter. Submitter unchanged.

## 2. Database

One migration:

- `ALTER TYPE` is awkward for the existing string column `mock_users.role` (it's text, not an enum) — just allow the new role strings; no schema change beyond a CHECK update if one exists.
- `ALTER TABLE pm_tasks ADD COLUMN teams text[] NOT NULL DEFAULT '{}'`
- `ALTER TABLE pm_template_tasks ADD COLUMN teams text[] NOT NULL DEFAULT '{}'`
- Backfill: for every existing row where `teams = '{}'`, set `teams` from `DEFAULT_TEAMS_FOR_TYPE[type]`.
- Index: `CREATE INDEX pm_tasks_teams_gin ON pm_tasks USING gin(teams);`
- Permissive RLS already covers these tables; no policy changes (auth still off).

## 3. Template builder

`src/pages/pm/TemplateBuilder.tsx` task row gets a **Teams** multi-select cell (chip popover) between Type and Phase. Defaults to the type's default team(s) on insert. Saves to `pm_template_tasks.teams`.

## 4. Template → project instantiation

`instantiateTemplateIntoProject` in `src/lib/pm/api.ts`: copy `teams` from each template task to the new `pm_tasks` row. Same for `AddPageDialog` / `pageGroups.ts` page-bundle expansion.

## 5. Live task editor

- **TaskWorkspace** `ControlPanel` (right rail): new **Teams** field, multi-select chips. Editable by PMs + assignee.
- **CreateWorkDialog / Quick add**: when a task type is picked, pre-fill `teams` from `DEFAULT_TEAMS_FOR_TYPE`; user can adjust before save.
- Reuse one new `TeamsMultiSelect` component (chips + popover, same visual language as `MultiAssigneeChip`).

## 6. "My Team" default filter

Add `src/hooks/useTeamFilter.ts` modeled on `useTypeFilter.ts`:

- Resolves `myTeam = ROLE_TO_TEAM[role]`
- Reads/writes `localStorage` key `pm.showAllTeams.{projectId}.{userId}` (bool, default `false`)
- Returns `{ showAll, setShowAll, myTeam, filterTask(task) }`

`filterTask(task)` rule: `showAll || role==='pm' || task.teams.includes(myTeam) || task.assignee_id === meId`.

Wire into:

- `TasksTab` (project) — primary surface, replaces nothing, layers on top of existing `pill`/`isMe` filters
- `BoardTaskCard` / Board view in TasksTab (same `filtered` list feeds it)
- `Work.tsx` global list — same filter applied here too, with the toggle living next to existing chip bar

The existing **type pills** (Design / Dev / QA / My Tasks) stay; they're narrower per-view overrides on top of the team default.

## 7. Toolbar UI

In `TasksTab` toolbar, right side, replacing nothing:

```text
[Showing my team (Design) ▾]   [Show all tasks]   [List | Board]
```

- Label shows `Showing my team ({TeamName})` when `showAll=false`, `Showing all tasks` when true.
- Click toggles. Sticky per project+user (see hook).
- Hidden entirely for PMs (they always see all) and Submitters (their visibility rules already restrict things).
- Same toggle pattern on `/pm/work` (global), sticky key `pm.showAllTeams.global.{userId}`.

## 8. Card visual

`BoardTaskCard`, `TaskRow`, `ProjectTaskCard`, `RequestTaskCard`: render team pills (small, neutral, max 2 + "+N") next to the type badge so multi-team tasks are visible at a glance.

## 9. Permissions / sidebar / route guard

`src/lib/pm/permissions.ts`:

- Extend `canSee` so the four new roles (`qa`, `csm`, `support`) behave like designer/developer: blocked from Templates, Forms builder, Integrations. Snippets stays designer+developer-only.
- `defaultTypesForRole` in `useTypeFilter.ts`: add sensible defaults (qa→[qa,review], csm→[approval,review], support→[dev,qa]) so the type-pill default also matches.
- `pm_set_task_track_from_assignee` DB trigger: extend role→track mapping (`qa`→production, `csm`→pm, `support`→production).

TopBar role switcher already enumerates `mock_users.role`, so adding rows with the new roles makes them selectable with no UI change. (Plan does **not** seed new mock users — user can add them in the existing user picker / via a quick seed if asked.)

## 10. Non-goals (this pass)

- No per-team assignee splitting (multi-assignee already exists).
- No reassignment of existing roles in `mock_users`.
- No changes to time tracking / scheduler / Gantt — they continue to include all tasks regardless of team filter (filter is UI-only, same pattern as `reveal_mode`).
- No team-based RLS (auth still off project-wide).

## Files touched

**New**
- `supabase/migrations/<ts>_task_teams.sql`
- `src/lib/pm/teams.ts` — `Team`, `TEAM_LABEL`, `ROLE_TO_TEAM`, `DEFAULT_TEAMS_FOR_TYPE`, `teamsFromTask`
- `src/hooks/useTeamFilter.ts`
- `src/components/pm/TeamsMultiSelect.tsx`

**Edited**
- `src/types/pm.ts` — extend `PmRole`, add `Team`, add `teams: Team[]` to `PmTask`
- `src/lib/pm/permissions.ts` — handle new roles
- `src/hooks/useTypeFilter.ts` — defaults for new roles
- `src/pages/pm/TemplateBuilder.tsx` — Teams cell in task row
- `src/lib/pm/api.ts` — copy `teams` in `instantiateTemplateIntoProject` + `updateTask`/`createTask` helpers
- `src/lib/pm/pageGroups.ts` / `AddPageDialog.tsx` — propagate teams when stamping page bundles
- `src/components/pm/workspace/ControlPanel.tsx` — Teams field
- `src/components/pm/CreateWorkDialog.tsx` — Teams field on quick-add
- `src/components/pm/project/TasksTab.tsx` — toolbar toggle + filter
- `src/pages/pm/Work.tsx` — same toolbar toggle + filter (global key)
- `src/components/pm/project/board/BoardTaskCard.tsx`, `collections/ProjectTaskCard.tsx`, `collections/RequestTaskCard.tsx` — team pills
