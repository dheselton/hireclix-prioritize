# Honest feedback when task sub-steps fail

Today, creating a task with extras (attachments, links, checklist, dependencies, watchers, co-assignees) can silently drop those extras: each sub-step swallows its error to the console and the dialog still reports "Task created". Worse, a co-assignee failure surfaces "Couldn't create task" even though the task was created.

Note: the file lives at `src/components/pm/project/NewTaskDialog.tsx` (not `src/components/pm/NewTaskDialog.tsx`); the logic described is at lines 262–318 as expected.

## What changes

Inside `handleSave`, after the main task insert succeeds:

- Track a `subFailures: string[]` list.
- Move the co-assignee loop below the task insert into its own try/catch so a failure records "co-assignees" instead of jumping to the outer catch.
- Each existing catch (attachments/links, checklist, dependencies, watchers) keeps its `console.error` and additionally pushes a short label: "attachments", "links", "checklist", "dependencies", "watchers", "co-assignees". Watchers are pushed once even if several individual watcher calls fail.
- Replace the unconditional success toast:
  - no failures: `toast.success("Task created")`
  - some failures: `toast.warning("Task created, but some details didn't save: <labels>")`
- The dialog still closes and `onCreated?.()` still fires in both cases — only the message changes.

The outer catch stays as-is, so a genuine task-creation failure still shows "Couldn't create task".

## Not touched

Task creation payload, form fields, validation, and the dialog's open/close behavior.
