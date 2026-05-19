Remove the side preview panel from Project Detail → Tasks tab and make rows/cards navigate directly to `/pm/tasks/:id`.

### Edits to `src/components/pm/project/TasksTab.tsx`
- Remove `TaskPreviewPanel` import, `selectedId` state, `selected`/`showPreview`, and the `useTaskDrawerLink` hook usage.
- Replace the outer grid wrapper with a plain `<div className="space-y-3">` (no two-column layout).
- Delete the `{selected && <TaskPreviewPanel … />}` block entirely.
- Replace each row/card `onClick` with `navigate(\`/pm/tasks/${task.id}\`)` using `useNavigate` from `react-router-dom`.
- Drop the `selected` prop from `TaskRow` and `TaskCard`; keep hover border (`hover:border-info`).

### File removal
- `src/components/pm/project/TaskPreviewPanel.tsx` is only used by `TasksTab`. Delete it.

### Files
- Edited: `src/components/pm/project/TasksTab.tsx`
- Deleted: `src/components/pm/project/TaskPreviewPanel.tsx`