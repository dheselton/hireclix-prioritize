## Goal

Make role-based visibility predictable and centralized so that when real auth is flipped on, each role automatically sees the right surfaces. Keep current dev-mode role switcher working. No visual redesign — reuse existing components and tokens.

## Roles & visibility matrix

Roles already in `mock_users`: `pm`, `designer`, `developer`, `strategist`, `analyst`, `submitter`.

| Surface | pm | designer / developer / strategist / analyst | submitter |
|---|---|---|---|
| `/pm` Daily Briefing | full (team-wide hero stats) | personal (my work + unclaimed in my track) | "My Requests" view (already exists) |
| `/pm/work` (all modes) | all projects/tasks | all projects/tasks they're a member of OR unclaimed in their track | hidden |
| `/pm/workload`, `/pm/timeline` | full | read-only, team-wide | hidden |
| `/pm/time` (Timesheet) | self + team toggle | self only | hidden |
| `/pm/templates`, `/pm/forms` builder, `/pm/integrations` | full | hidden | hidden |
| `/snippets` (+ Incidents tab) | visible | designer/developer only (current rule) | hidden |
| Project detail | members + PMs | members only (others get "request access" empty state) | hidden |
| TaskWorkspace | members + PMs | assignee, co-assignees, project members, or unclaimed-in-track | only their own submitted tasks |

Briefing rule preserved: dashboard = my work + unclaimed in my track. Broader Work view = cross-team as permitted above.

## Implementation

### 1. Central permissions module — `src/lib/pm/permissions.ts` (new)

Single source of truth. Pure functions keyed on `PmRole` (+ optional userId / projectMembership):

```ts
canSee(role, surface)              // route-level gate
canSeeProject(role, userId, project, members)
canSeeTask(role, userId, task, projectMembers)
briefingScope(role)                // 'team' | 'personal' | 'submitter'
workViewScope(role, userId)        // filter spec for /pm/work queries
timesheetScope(role)               // 'team-toggle' | 'self' | 'hidden'
```

`useRoleGate()` hook wraps `useCurrentUser` and exposes these helpers + `role`.

### 2. Route guard generalization

Rename/extend `SubmitterRouteGuard` → `RoleRouteGuard` (keep old export as alias to avoid churn). Drives BLOCKED_PREFIXES from `permissions.ts` per role. Submitter rules unchanged; non-PM staff stay allowed everywhere except `/pm/templates`, `/pm/forms/`, `/pm/integrations` (redirect to `/pm/work`).

### 3. Sidebar (`AppSidebar.tsx`)

Filter nav items by `canSee(role, surface)`. No restructure — just hide entries the role can't access (matches today's submitter handling).

### 4. Daily Briefing (`/pm`)

`briefingScope(role)` switches the hero/stat queries already in `src/lib/pm/briefing.ts`:
- `team`: existing behavior (PM).
- `personal`: hero counts scoped to `assignee_id = me OR (status='unclaimed' AND track=myTrack)`; Project Work column already shows my projects.
- `submitter`: existing My Requests view.

Tile/CTA links continue to use `buildQueueLink` with appropriate `assignee`/`unclaimed` chips so they keep honoring filters.

### 5. `/pm/work` query scoping

`useWorkQueries` (or equivalent in `src/pages/pm/Work.tsx`) gains `workViewScope`:
- PM: no extra filter.
- Staff: `project_id IN myProjects OR (status='unclaimed' AND track=myTrack)`.
- Submitter: blocked by guard.

Filter chips/UI unchanged.

### 6. Project detail & TaskWorkspace

`canSeeProject` / `canSeeTask` gates render a small empty state ("You don't have access to this project — ask the PM to add you") using existing `Card` + `EmptyState` styling. No redesign.

### 7. Auth-ready plumbing (no behavioral change yet)

- `getCurrentUserId()` already abstracts the source. Add `getAuthUserId()` placeholder in `mockUser.ts` that returns `supabase.auth.getUser()` id when a `VITE_PM_AUTH_ENABLED` flag is true, falling back to the localStorage mock id otherwise. All call sites already use the helper, so flipping the flag is a one-line switch later.
- Document in memory: when auth is enabled, role comes from `user_roles` (existing table) joined to `mock_users` by email; no policy work in this step.
- RLS stays permissive in this pass (per existing memory note); plan mentions tightening as a follow-up so behavior remains predictable now.

### 8. TopBar role switcher

Keep visible while `VITE_PM_AUTH_ENABLED` is false. Hide automatically when the flag flips on. No styling change.

## Out of scope

- Real Supabase auth wiring, sign-in UI, RLS tightening, email confirmations.
- Any nav/layout redesign or new visual treatments.
- Per-project role overrides (members table already covers needs).

## Files

- New: `src/lib/pm/permissions.ts`
- Edited: `src/components/pm/SubmitterRouteGuard.tsx` (extend), `src/App.tsx` (rename usage), `src/components/AppSidebar.tsx`, `src/lib/pm/mockUser.ts` (auth-ready accessor), `src/lib/pm/briefing.ts`, `src/pages/pm/Work.tsx`, `src/pages/pm/ProjectDetail.tsx`, `src/pages/pm/TaskWorkspace.tsx`, `src/pages/pm/Timesheet.tsx`, `mem://index.md` (note the permissions module + auth flag).

## Verification

- Switch role via TopBar through pm / designer / developer / submitter and confirm: sidebar items, `/pm` scope, `/pm/work` rows, project & task gating, snippets, timesheet.
- Build passes; no visual diff for PM role.
