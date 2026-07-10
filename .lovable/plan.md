
# Performance improvements (no auth changes)

Goal: make initial load, screen transitions, heavy screens, and dev role switching feel snappy — while keeping the mock user switcher and disabled auth exactly as they are.

## What's actually slow (and why)

1. **Initial load** — `src/App.tsx` eagerly imports every page (WorkQueue, Work, ProjectDetail, Workload, GlobalTimeline, Timesheet, Templates, TemplateBuilder, Forms, FormBuilder, Snippets, TaskWorkspace, roadmap pages…). All of that ships in the first JS bundle before `/pm` can render.
2. **Screen switches** — react-query has default `staleTime: 0`, so navigating between `/pm` → `/pm/work` → project detail refetches the same tables (`mock_users`, `pm_projects`, watchers, tags, client flags, project teams). Also every page re-computes helpers that could be memoized/shared.
3. **Heavy screens** — Gantt (custom SVG), Workload, Timesheet grid, and Kanban render large trees; they're bundled into the main chunk and don't virtualize long lists.
4. **User switch** — `writeCurrentId` only triggers `useCurrentUser` subscribers, but downstream data (briefing, unclaimed counts, my-tasks) doesn't invalidate, so screens show stale data until the next natural refetch — feels like a "hang" while old and new data flicker.

## Changes

### 1. Route-level code splitting (biggest single win for initial load)
- In `src/App.tsx`, convert every page import except `WorkQueue` (the default `/pm` landing) to `React.lazy(() => import(...))`.
- Wrap `<Routes>` in a single `<Suspense fallback={<RouteFallback />}>`. `RouteFallback` = lightweight skeleton (existing spinner style) in `src/components/RouteFallback.tsx`.
- Expected effect: initial JS drops significantly; Gantt/TemplateBuilder/Snippets/Timesheet only load when visited.

### 2. React Query cache tuning
- In `src/App.tsx`, configure `QueryClient` with `defaultOptions: { queries: { staleTime: 60_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1 } }`.
- Audit hooks that already use react-query (`useProjectTeam`, `useInternalClientIds`, `useCareerSiteProjects`, tag catalog, mock_users) and ensure they share stable query keys so they're deduped across pages.
- Convert `loadUsers()` in `src/lib/pm/mockUser.ts` from ad-hoc module cache to a react-query-backed hook internally, keyed `['mock_users']`, `staleTime: 5 * 60_000`. Keep the existing public API (`useCurrentUser`, `getCurrentUserId`, etc.) unchanged.

### 3. Make user switching feel instant
- When `setCurrent(id)` runs in `mockUser.ts`, call `queryClient.invalidateQueries()` for the small set of user-scoped keys: briefing, unclaimed counts, my-tasks, workload-for-user, timesheet-for-user. (Not a blanket invalidate — that would refetch everything.)
- Add a tiny `useOnUserChange(callback)` helper for any page that needs to react locally.

### 4. Heavy screen wins
- **GlobalTimeline / Gantt / Workload / Timesheet / TemplateBuilder / Snippets**: already covered by lazy loading above. Additionally:
  - Memoize row/column derivations in `TimesheetGrid`, `WorkKanban`, and Gantt with `useMemo` keyed on the raw inputs (many currently recompute on every render).
  - Guard `TaskKanban` / `WorkKanban` DnD listeners so they don't remount on unrelated state changes.
- Skip virtualization for now (bigger change, save for a follow-up if still slow after the above).

### 5. Small cleanups that add up
- Debounce `GlobalSearch` input (250ms) to stop firing queries per keystroke.
- Ensure `ActiveTimerProvider` re-renders only its own subtree (split the "seconds ticking" state out of context so consumers that only need `activeTimer` don't rerender every second). Only touch this if it's currently re-rendering the whole tree — will confirm during implementation.

## Explicitly NOT changing
- Auth (`VITE_PM_AUTH_ENABLED` stays false).
- The dev role/user switcher dropdown in `TopBar`.
- Mock user seeding, permissions logic, RLS policies.
- Any product behavior — this is purely a perf pass.

## Files touched
- `src/App.tsx` — lazy routes, Suspense, QueryClient defaults
- `src/components/RouteFallback.tsx` — new tiny skeleton
- `src/lib/pm/mockUser.ts` — react-query-backed users, invalidate on switch
- `src/components/GlobalSearch.tsx` — debounce
- `src/components/pm/time/TimesheetGrid.tsx`, `src/components/pm/work/WorkKanban.tsx`, `src/components/pm/GanttChart.tsx` — memo passes
- Possibly `src/components/pm/timer/ActiveTimerProvider.tsx` — split ticking state (only if needed)

## Verification
- Build to confirm chunks split (look for separate chunks for Templates/Timesheet/Gantt).
- Click through `/pm` → `/pm/work` → project → `/pm/time` → `/pm/workload` and confirm no full-page spinner between navigations.
- Switch users in the dropdown and confirm briefing updates without a visible stall.
