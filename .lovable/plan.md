## Goal

Make new requests visible to everyone until claimed, add prominent claim affordances, and surface project team avatars on both project cards and task cards. Tasks remain single-owner; projects already have a team via `pm_project_members`.

## 1. Quick Tasks column — two sections

Edit `src/lib/pm/briefing.ts` to return two arrays:

- `unclaimedQuickTasks` — every task where `status = 'unclaimed'` AND project `work_type = 'request'` (visible to all users until grabbed).
- `myQuickTasks` — current behavior (assignee_id = me, request work_type, non-terminal).

Edit `src/components/pm/workqueue/QuickTasksColumn.tsx` to render two labeled sections inside the same card:

```text
🔥 UNCLAIMED  (n)         <- amber accent, pulse dot
  [task row]  [Claim →]    <- ClaimButton inline, bigger
  [task row]  [Claim →]

👤 MY QUICK TASKS  (n)
  [task row]              <- existing styling
  [task row]
```

Unclaimed rows use amber left-border + the existing `ClaimButton` (size `sm`) on the right. Empty unclaimed section is hidden. When the unclaimed list is long, scroll within the section; the "My" section always stays visible below via a flex layout.

Reactivity: `useTasksChanged` already fires on claim — so when someone else claims a task, it disappears from everyone's view on next refresh. Add the existing emit inside `ClaimButton` (already calls `updateTask` which emits via `bumpTasksChanged`); confirm by reading `api.ts`.

## 2. Project team avatars

**On `ProjectBriefingCard`** (Project Work column):
- Fetch project members in `briefing.ts` and attach `team: MockUser[]` (deduped, requester last) to each project in the returned list.
- Render a small `AvatarStack` (new component, max 4 + `+N`) in the card header next to the status pill.

**On task cards** — add `AvatarStack` showing the project team, with the task's assignee rendered first and visually highlighted (ring). Add to:
- `src/components/pm/collections/RequestTaskCard.tsx`
- `src/components/pm/collections/ProjectTaskCard.tsx`
- `src/components/pm/project/board/BoardTaskCard.tsx`

For unclaimed tasks: where the assignee avatar would be, render a dashed "Claim" chip + the project team stack faded behind it.

## 3. New components

- `src/components/pm/AvatarStack.tsx` — `props: { userIds: string[]; max?: number; size?: 'xs'|'sm'; highlightId?: string }`. Renders overlapping `UserAvatar`s with `-ml-2` and a "+N" bubble.
- Tweak `QuickTasksColumn.tsx` to support the two-section layout (one card, two labeled groups).

## 4. Visual polish for new unclaimed cards

- Amber left border (`border-l-4 border-l-amber-500`) on unclaimed rows in both the Quick Tasks column and any task card.
- Subtle pulse dot using existing `unclaimed-pulse` class.
- `ClaimButton` already styled amber — reuse as-is.

## 5. Data — no schema changes needed

Multi-assignee on tasks is intentionally **not** built (per your answer). Project teams already exist via `pm_project_members`. We'll just read them.

## Files

**New**
- `src/components/pm/AvatarStack.tsx`

**Edited**
- `src/lib/pm/briefing.ts` — add `unclaimedQuickTasks`, attach `team` to projects.
- `src/pages/pm/WorkQueue.tsx` — pass `unclaimedQuickTasks` to `QuickTasksColumn`.
- `src/components/pm/workqueue/QuickTasksColumn.tsx` — two-section layout, inline `ClaimButton`.
- `src/components/pm/workqueue/ProjectBriefingCard.tsx` — render `AvatarStack` in header.
- `src/components/pm/collections/RequestTaskCard.tsx`
- `src/components/pm/collections/ProjectTaskCard.tsx`
- `src/components/pm/project/board/BoardTaskCard.tsx`

## Out of scope (flag for later)

- Bulk multi-assignee on tasks (you chose single-owner).
- Notifications when a teammate claims/un-claims (existing activity log already records `task.claimed`).
