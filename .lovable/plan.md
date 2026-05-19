Enhance Project Detail → Tasks tab rows and cards with subtask progress + description preview.

### Edits to `src/components/pm/project/TasksTab.tsx`

1. Import `useSubtaskCounts` from `@/components/pm/SubtaskBadge`.
2. Inside `TasksTab`, compute `taskIds = filtered.map(t => t.id)` and `counts = useSubtaskCounts(taskIds)`.
3. Pass `count = counts.get(t.id)` to both `TaskRow` and `TaskCard`.
4. Add a `stripHtml(html)` helper (strip tags + collapse whitespace) used to preview `task.description` (which is HTML from the rich editor).

### `TaskRow` updates
- Change outer layout from a single horizontal flex to: colored bar + a flex-1 column containing:
  - top line: title (truncated) + inline subtask pill `2/5` (only if total > 0)
  - second line (only if description): `<p class="text-[11px] text-muted-foreground truncate">{preview}</p>`
- Keep type badge, avatar, due date, priority dot on the right (same as today).
- Subtask pill style: `text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium`.

### `TaskCard` updates
- Add `min-h-[110px]` to `CardContent` to fit extra info without feeling bloated.
- Under title, add description preview (only if exists): `<p class="text-[11px] text-muted-foreground line-clamp-2">{preview}</p>`.
- In the footer row, add a third element on the left: subtask text `2/5 subtasks` (only if total > 0), styled `text-[11px] text-muted-foreground`. Reorganize footer so date + subtasks sit left, avatar right.

No DB changes. No new files.