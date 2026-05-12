## What's actually broken

I dug into the data and code. There are **two real bugs**, both fixable in minutes.

### Bug 1 — Switching users in the top-bar dropdown doesn't update the rest of the app
`useCurrentUser()` keeps the current user id in **local component state** and only writes to localStorage. The TopBar's copy updates, but every other page (WorkQueue, Board, Workload, Timeline, etc.) has its own instance that read localStorage *once on mount* and never re-renders. So changing the user in the picker visibly flips the avatar in the top-bar but leaves all task lists frozen on the original user. Track toggle has the same publish/subscribe pattern as `useTrackMode` and works correctly — `useCurrentUser` was never wired the same way.

**Fix:** Convert `useCurrentUser` to a tiny pub/sub store (same pattern as `useTrackMode` / `useMockUsers`) so every component re-renders when the current user changes.

### Bug 2 — Assigned tasks still show as "unclaimed"
Data check on `pm_tasks`:
- 200 / 200 rows have `assignee_id` set
- 197 / 200 still have `status = 'unclaimed'`

The seed inserted assignees but left status default. So WorkQueue's "Unclaimed Requests" bucket shows almost everything, and "My Tasks" looks tiny no matter who you're viewing as. That also makes the Track toggle look like it's doing nothing — both PM and Production tracks are full of "unclaimed" rows that all funnel into the same section.

**Fix (data):** One-time UPDATE — any task with an `assignee_id` and current status `unclaimed` becomes `claimed`. Going forward, the existing assignee trigger should also bump status from `unclaimed` → `claimed` when an assignee is set (and clear back to `unclaimed` when assignee is removed). Tasks already `in_progress`, `blocked`, `complete`, `approved`, `review` are left alone.

### Bonus polish (small)
- WorkQueue's "Unclaimed" stat right now counts *all* unclaimed in the visible track. Once Bug 2 is fixed, that becomes the true backlog number, which is what you actually want.
- The WorkQueue subtitle ("Viewing as PM") will now correctly change when you switch users — useful confirmation that the dropdown took effect.

## Plan

```text
1. src/lib/pm/mockUser.ts
   • Add module-level currentId + subscribers (like useTrackMode).
   • useCurrentUser reads from store, subscribes, setCurrent broadcasts.
   • Default-pick a PM on first load if nothing in localStorage.

2. supabase migration
   • Update pm_set_task_track_from_assignee trigger (or add a sibling
     trigger pm_set_task_status_from_assignee) so:
       - INSERT/UPDATE: assignee_id IS NOT NULL AND status = 'unclaimed'
         → status := 'claimed'
       - UPDATE: assignee_id set to NULL AND status = 'claimed'
         → status := 'unclaimed'

3. supabase data update (insert tool, not migration)
   • UPDATE pm_tasks SET status='claimed'
       WHERE assignee_id IS NOT NULL AND status='unclaimed';

4. Quick verify
   • SELECT status, count(*) → expect ~3 in_progress, ~197 claimed, 0 unclaimed.
   • In preview: switch user in TopBar → My Tasks count changes.
   • Toggle PM ↔ Production → list visibly changes.
```

No UI/visual changes. No new files. Two small edits + one data backfill.

Ready to implement?