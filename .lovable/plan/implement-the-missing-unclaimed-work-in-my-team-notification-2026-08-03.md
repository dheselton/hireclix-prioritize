# Implement the missing "Unclaimed work in my team" notification

Option A: build the producer, since unclaimed-team alerts are a real product need (unclaimed queue visibility is core to the Daily Briefing).

## What changes for users

- When a new task is created as unclaimed (quick requests, intake, any unassigned task), everyone whose role maps to that task's team gets an in-app notification: "Unclaimed <Team> task: <title>", linking straight to the task.
- Users who turned the "Unclaimed work in my team" toggle off get nothing — the existing preference check already handles that.
- The creator never notifies themselves, and PM/CSM users who already receive the separate "New request submitted" alert for the same task do not get a duplicate unclaimed alert.

## Technical details

`src/lib/pm/api.ts` — inside `createTask`, in the existing best-effort notification `try` block, right after the current `status === 'unclaimed'` PM/CSM `new_request` loop (same `allUsers` fetch, no extra query):

1. Derive the task's teams with `teamsFromTask(data)` from `@/lib/pm/teams`; if empty, fall back to `DEFAULT_TEAMS_FOR_TYPE[data.type]`. Skip entirely when still empty.
2. For each user in the already-fetched `mock_users` list, resolve their roles multi-role style (`roles[]` when present, else `[role, secondary_role]`), map each role through `ROLE_TO_TEAM`, and expand with `TEAM_PEERS` plus `USER_TEAM_OVERRIDES[user.id]?.peers` so Creative+Dev and multi-hat users are covered.
3. Notify a user when their team set intersects the task's teams. Skip the creator, skip anyone already notified in the `new_request` loop above (track their ids in a `Set`), and skip the assignee.
4. Send via the existing `createNotification({ user_id, event_type: 'unclaimed_team', title: \`Unclaimed ${TEAM_LABEL[team]} task: ${title}\`, link: \`/pm/tasks/${id}\` })` — preference filtering and the change event are already handled inside it.

No changes to `notifications.ts`, the settings UI, other event types, or any other task-creation logic.
