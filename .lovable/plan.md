# Fix project "Watch" silent no-op

Going with Option A: if you're already on a project team, you're watching it by default. No schema change, no new table.

## What changes for users

- Clicking "Watch this project" when you're already a member no longer does nothing. You get a clear message: "You're already a member — you're watching by default", and the menu flips to the watching state.
- Clicking Watch when you're not on the project adds you as a watcher and shows "Now watching this project".
- If it fails, you see an error toast instead of silence.
- The "Watching" filter now includes projects you're a member of, not only ones you explicitly watch — so assigned projects show up where you'd expect.
- Unwatching a project you're a member of tells you it stays visible because you're on the team (it does not remove your membership).

## Technical details

`src/lib/pm/watchers.ts`
- `watchProject`: keep the existing-row lookup, but return the existing role so callers can distinguish "already a watcher" from "already a member". Shape: `{ ok, existed, existingRole }`.
- `isWatchingProject`: return true when a row exists for the user on the project with any role (member rows count as watching), instead of requiring `role='watcher'`.
- `fetchWatchedProjectIds`: drop the `role='watcher'` filter so membership-implied watching flows into `useWatchedTaskIds` and the task-level "watching" chip.
- `unwatchProject`: unchanged deletion logic (still only deletes `role='watcher'` rows); it will report back whether a watcher row was actually removed so the UI can explain when membership keeps the project visible.

`src/lib/pm/filters.ts`
- Line 98 `case "watching":` — replace the hard `return false` with a membership/watch check using the `memberProjectIds` set already passed in (falls through instead of failing the project).

`src/pages/pm/TaskWorkspace.tsx`
- `toggleWatchProject`: branch the toast on the new return value — "Now watching this project" vs "You're already a member — you're watching by default"; error toast on failure. Set watching state to true in both success cases.

Not touched: membership creation/removal elsewhere, permission checks, notification delivery, task-level watching.
