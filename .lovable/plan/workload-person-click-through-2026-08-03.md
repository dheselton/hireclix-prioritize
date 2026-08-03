# Workload person click-through

## Current state (verified)

This is already implemented:

- `src/pages/pm/Workload.tsx` (lines 94-104) wraps each person's avatar + name in a `<Link to={`/pm/work?user=${u.id}`}>` with a hover background, tooltip ("See all work assigned to ..."), and pointer cursor.
- `src/pages/pm/Work.tsx` reads `?user=` on mount into `personId` (line 114), filters tasks to that person including co-assignees (lines 149-150), strips the param from the URL, and shows a "this person" filter banner (line 207).

## Remaining polish

Only one small affordance gap: the person's name itself doesn't read as a link — the only cue is a hover background on the row.

Change (Workload.tsx only): add `group` to the Link and `group-hover:underline` to the name text so the name underlines on hover, keeping the existing hover background.

Heat-map calculation, grid layout, and filter chips stay untouched.
