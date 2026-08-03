# Finish the multi-role cleanup: two remaining singular role reads

All ten locations from the audit already use the `roles[]` union. Two smaller spots still read the primary role only.

## 1. Work page — "Quick Request" / "New Project" buttons

`src/pages/pm/Work.tsx` hides the create buttons when the primary role is `submitter`. A user whose primary role is Submitter but who also holds PM/Designer/Developer loses those buttons.

Change the check to hide the buttons only when the user is submitter-only (no other roles), matching the pattern already used in the sidebar.

## 2. Project detail — default task type in New Task dialog

`src/pages/pm/ProjectDetail.tsx` passes the primary role to `NewTaskDialog`, which uses it to pick the default task type (design / dev / etc.). For a multi-role user this can default to the wrong discipline.

Pass a role chosen from the union instead, preferring a "doer" role (developer, designer, strategist, analyst) over PM so the default task type reflects the work the person actually does; fall back to the first role held.

## Technical notes

- No changes to the permission model, `useCurrentUser`, or `NewTaskDialog`'s props/signature.
- Both edits are local: one conditional in `Work.tsx`, one derived value passed as `meRole` in `ProjectDetail.tsx`.
