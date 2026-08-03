# Replace native confirm() with AlertDialog

Standardize destructive confirmations on the app's `AlertDialog` pattern (the one already used for project delete in `ProjectHeader.tsx`).

## New shared component

Add `src/components/pm/ConfirmDialog.tsx` — a small controlled wrapper around shadcn `AlertDialog`:

- Props: `open`, `onOpenChange`, `title`, `description`, `confirmLabel` (default "Confirm"), `cancelLabel` ("Cancel"), `destructive` (default true → destructive button styling), `busy`, `onConfirm` (async-aware).
- Renders title/description, Cancel + Confirm buttons; Confirm calls `onConfirm()` and shows a pending label while awaiting.

This keeps five call sites from each hand-rolling the same markup.

## Call sites converted

1. `src/components/pm/project/ProjectHeader.tsx`
   - Exit Support mode (line ~166): "Exit Support mode?" / "Build tasks will return to the main board. QA and support tickets are not deleted."
   - Exit QA mode (line ~198): "Exit QA mode?" / "QA tickets stay in the project, but the QA tab will be hidden."
   - Both become local state flags set from the dropdown item; the existing async bodies move into `onConfirm` unchanged. Delete-project AlertDialog stays as-is.
2. `src/components/pm/workqueue/NoteDialog.tsx` (line ~56) — "Delete this note?" / "This note will be permanently removed."
3. `src/components/pm/time/ActivitiesStrip.tsx` (line ~257) — "Delete activity?" / naming the activity, noting existing time entries will be detached.
4. `src/components/pm/project/TasksTab.tsx` (line ~619) — "Remove this page?" / page label + task count that will be deleted. Needs a small state holder (`pendingPageRemoval: { key, label, count } | null`) since the trigger is inside a map.
5. `src/components/pm/project/PagesTab.tsx` (line ~79) — "Remove this page?" / all tasks for that page will be deleted; same pending-state pattern in `removePage`.

## Out of scope

Delete/update logic, Supabase calls, toasts, and event emissions stay exactly as they are — only the confirmation UI changes. Other `confirm()` calls elsewhere in the app (Snippets, TaskDrawer, ConfigureTimelinePanel, etc.) are not touched in this pass.
