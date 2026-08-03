# Consolidate terminal task status checks

## Goal
Define a single source of truth for "task is done / terminal" and replace the scattered, inconsistent local checks across the codebase. This will fix progress bars, completion counts, and phase logic that currently disagree because each file uses a slightly different status set.

## What will change

1. **Canonical definition in `src/types/pm.ts`**  
   Add a constant and helper next to the existing `TaskStatus` type and `TASK_STATUSES` array:

   ```ts
   export const TERMINAL_STATUSES: TaskStatus[] = ['complete', 'approved', 'cancelled'];
   export const isDone = (status: TaskStatus): boolean => TERMINAL_STATUSES.includes(status);
   ```

   The values are taken directly from the valid `TaskStatus` union (`unclaimed | claimed | in_progress | blocked | in_review | approved | complete`). Note: `cancelled` is included as a terminal status, even though it is not currently produced by the UI, to keep the helper complete for future use.

2. **Replace local checks in the following files**  
   Each file currently defines its own terminal-status array or inline check. They will import `isDone` / `TERMINAL_STATUSES` from `@/types/pm` and use them instead.

   - `src/lib/pm/briefing.ts` line 7 — `const TERMINAL = new Set(["complete", "approved"])` → `isDone()`
   - `src/lib/pm/taskVisualState.ts` line 14 — `const DONE_STATES = new Set(["complete", "approved"])` → `isDone()`
   - `src/lib/pm/notifications.ts` line 178 — inline `["complete", "approved"].includes(t.status)` → `isDone(t.status)`
   - `src/lib/pm/statusGroups.ts` line 22 — `statuses: ["complete", "approved"]` → `TERMINAL_STATUSES` (for the complete group definition)
   - `src/lib/pm/reveal.ts` line 20 — `const COMPLETE_STATES: TaskStatus[] = ["approved", "complete"]` → `TERMINAL_STATUSES`
   - `src/lib/pm/snippetIncidents.ts` line 22 — `const DONE_STATUSES: TaskStatus[] = ["approved", "complete"]` → `TERMINAL_STATUSES`
   - `src/lib/pm/filters.ts` line 49 — inline `t.status === "complete" || t.status === "approved"` → `isDone(t.status)`
   - `src/lib/pm/pageGroups.ts` line 316 — `const DONE_STATUSES = new Set(['complete', 'completed', 'done', 'approved'])` → `isDone()`. Also remove the non-canonical `'completed'` and `'done'` values from this check (they are not valid `TaskStatus` values).

   Note: the user-specified path was `src/components/pm/project/pageGroups.ts`; the actual file is `src/lib/pm/pageGroups.ts`.

## What will NOT change
- The `TaskStatus` enum values themselves.
- Any status transition logic, UI labels, or status pickers.
- Any behavior that intentionally checks only a subset of terminal statuses (e.g., `STARTED_STATES` in `reveal.ts` remains unchanged).

## Verification
After the change:
- All terminal-status checks route through `isDone()` or `TERMINAL_STATUSES` from `src/types/pm.ts`.
- `pageGroups.ts` no longer references the invalid `'completed'` or `'done'` strings.
- TypeScript typecheck passes.
- No runtime behavior changes for the currently valid statuses (`complete`, `approved`).
