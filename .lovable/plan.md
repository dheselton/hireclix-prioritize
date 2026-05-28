## Bug
Intake (Quick Request via `CreateWorkDialog` and `PublicForm`) auto-assigns every new task to the requester and sets `status = "claimed"`. Result: when a teammate submits a request on their own behalf, the task lands pre-claimed and never surfaces in the unclaimed Quick Tasks queue, so the team misses new work.

Requester is project-level metadata only (drives Briefing visibility via `pm_project_members.role='requester'`). It must not auto-own the task.

## Fix
All intake-created tasks are always `unclaimed` with `assignee_id = null`, regardless of who submitted them or whether the requester is on the team.

### Files

1. `src/components/pm/CreateWorkDialog.tsx` (~L172–186, Quick Request flow)
   - Drop the `assigneeForTasks` derivation.
   - In the `pm_tasks` insert: set `status: "unclaimed"` and `assignee_id: null` unconditionally.
   - Keep `created_by`, `requested_by` (on project), description mirroring, and attachment behavior unchanged.

2. `src/pages/pm/PublicForm.tsx` (~L75–81, single-task action)
   - Same change: `status: "unclaimed"`, `assignee_id: null`. Public form already shouldn't auto-claim; this also makes the team-internal case correct if a logged-in teammate uses a public link.

### Out of scope (intentionally unchanged)
- `createTask()` in `src/lib/pm/api.ts` keeps auto-claiming the creator. That helper is used inside the workspace (PM/designer adding follow-up tasks to an existing project), where "I created it for myself" is the right default. Intake never calls it.
- Project-level `requested_by` and the `role='requester'` membership row stay — they're how the project shows up in the requester's Briefing without owning tasks.
- No schema or RLS changes.

### Verify
- Submit a Quick Request as a team member → resulting task appears in the unclaimed section of Quick Tasks with the amber Claim CTA, not in "my claimed" tasks.
- Submitter-role intake still works the same (already unclaimed before).
- Existing pre-claimed tasks are not migrated (only fixes new submissions).

### Memory
Add a line to Core: "Intake (CreateWorkDialog + PublicForm) ALWAYS creates tasks `unclaimed` with `assignee_id=null`. Requester is project metadata only — never task owner."
