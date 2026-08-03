# Consolidate the two Team vocabularies

The 8-team list in `src/lib/pm/teams.ts` becomes the single canonical vocabulary. The 4-team duplicate lives in `src/types/pm.ts` (the type) and `src/lib/pm/track.ts` (the duplicate `TEAM_LABEL` / `TEAM_ACCENT` maps and the mapping functions) — note the duplicate label map is in `track.ts`, not `types/pm.ts`.

## What changes for users

Nothing visible. One string is preserved deliberately: the unclaimed-work banner currently says "unclaimed creative work" for designers/developers. Because `creative` is being replaced by the canonical `design` / `dev`, that banner keeps its existing wording through a small display override rather than switching to "design work".

## Technical details

`src/types/pm.ts`
- Replace `export type Team = 'creative' | 'pm' | 'strategy' | 'analytics'` with a re-export of the canonical type: `export type { Team } from "@/lib/pm/teams";` so every existing `import type { Team } from "@/types/pm"` keeps working against the 8-team union.

`src/lib/pm/track.ts`
- Delete the local `TEAM_LABEL` map (lines 57–62). Re-export the canonical one (`export { TEAM_LABEL } from "@/lib/pm/teams";`) so `UnclaimedBanner`'s existing import path stays valid.
- Keep `TEAM_ACCENT` but rewrite it over the 8 canonical keys: `design` and `dev` inherit the previous `creative` value (`hsl(var(--primary))`); `pm`, `strategy`, `analytics` keep their current values; add `qa`, `csm`, `support` using the matching `TEAM_COLOR` values from `teams.ts`.
- `teamForType`: `design`/`content` → `design`, `dev` → `dev`, `qa` → `qa`; strategy/research → `strategy`; analytics/reporting → `analytics`; review/approval/default → `pm`. This aligns it with `DEFAULT_TEAMS_FOR_TYPE` in `teams.ts`.
- `teamForTask`: `track === "production"` no longer returns `creative` — fall through to `teamForType(t.type)` so production tasks resolve to `design` or `dev` by type.
- `teamForRole`: delegate to `ROLE_TO_TEAM` from `teams.ts` (designer → `design`, developer → `dev`, tech_lead → `dev`, ba → `pm`, etc.), defaulting to `pm` when the role maps to null.

`src/components/pm/UnclaimedBanner.tsx`
- Line 66 builds the label from `TEAM_LABEL[myTeam].toLowerCase()`. Add a display override so `design` and `dev` render as "creative" (the current wording); all other teams use `TEAM_LABEL` as before.

`src/components/AppSidebar.tsx`
- No change needed — it only compares `teamForRole` output against `teamForTask` output, both of which move to the canonical vocabulary together.

Not touched: `teams.ts` labels and colors, `TeamsMultiSelect`, `teamsFromTask`, the `pm_tasks.teams` column, or any team-assignment logic.
