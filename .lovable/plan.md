## Goal
Support users holding multiple roles (e.g. Dan = PM + Designer + Developer) so their access is the **union** of all assigned roles. Fix the current issue where the "Project Manager" pill hides snippets, dev/design surfaces, and workspace sections from a multi-role user.

## Approach
Move from a single `role` (+ optional `secondary_role`) to a **roles array**. Every permission check becomes "does ANY of the user's roles allow this?". Keep the existing `role` field as the *primary/display* role so pills and grouping stay unchanged.

## Changes

### 1. Data model
- Add `roles text[]` column to `mock_users` (backfilled from `role` + `secondary_role`).
- Seed Dan Heselton with `{pm, designer, developer}`; keep others as their single role.
- `MockUser` type gains `roles: PmRole[]`.

### 2. Permissions (`src/lib/pm/permissions.ts`)
- Add `canSeeAny(roles: PmRole[], surface)` = `roles.some(r => canSee(r, surface))`.
- New `blockedRoutePrefixesFor(roles)` and `fallbackPathFor(roles)` using the union.
- `briefingScope` / `timesheetScope`: if roles include `pm`, use PM scope; else most-permissive of remaining.
- `canSeeProject` / `canSeeTask`: pass roles, return true if any role grants access (PM in the set = full access).

### 3. Consumers
- `useCurrentUser()` returns `roles: PmRole[]` alongside existing `role` (primary).
- `RoleRouteGuard` (`SubmitterRouteGuard.tsx`): use `blockedRoutePrefixesFor(roles)`.
- `AppSidebar`: swap `canSee(role, ...)` calls for `canSeeAny(roles, ...)` so snippets, templates, integrations, etc. appear for any qualifying role.
- `TopBar` pill: still shows primary `role` label, but appends `+N` when `roles.length > 1` (tooltip lists all). User list rows already show `+Secondary` — update to list all extra roles.
- Any other `role === "designer" || role === "developer"` style checks (snippets tab visibility, TaskWorkspace sections) switch to `roles.includes(...)`.
- `useTeamFilter` / `USER_TEAM_OVERRIDES`: derive peers from union of roles' teams instead of the hard-coded Dan override (keeps override table for edge cases but no longer required for multi-role users).

### 4. Backward compatibility
- Keep `role` and `secondary_role` columns; new code reads `roles` with a fallback: `user.roles ?? [user.role, user.secondary_role].filter(Boolean)`.
- Auth flag path (`getAuthUserId`) unaffected — when real auth lands, roles will come from `user_roles` table the same way.

## Out of scope
- No UI to edit a user's roles yet (still seeded in DB). Can add an admin editor later if wanted.
- No changes to task assignment logic — assignees are still single-user.

## Files touched (approx.)
- migration: add `roles` column + backfill + Dan seed
- `src/types/pm.ts`
- `src/lib/pm/mockUser.ts`
- `src/lib/pm/permissions.ts`
- `src/components/pm/SubmitterRouteGuard.tsx`
- `src/components/AppSidebar.tsx`
- `src/components/TopBar.tsx`
- `src/lib/pm/teams.ts` / `useTeamFilter.ts` (derive peers from roles)
- Any remaining `role ===` gates for snippets/dev/design surfaces
