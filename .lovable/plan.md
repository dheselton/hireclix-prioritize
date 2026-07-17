## Why it feels buggy

- **Every keystroke re-renders every row.** `TaskRow` and `BoardTaskCard` receive a fresh `onToggleSelect={() => toggleSelect(t.id)}` closure on every parent render, and neither component is memoized. Selecting one card re-mounts Radix popovers inside every other card — that's also the source of the "Maximum update depth" warning coming from `AssigneePopover` in the console.
- **Bulk actions fan out N round-trips.** `BulkTaskActions` maps every selected id to its own `updateTask` / `updateTask` call. Selecting 20 tasks and changing status = 20 sequential API updates before the toast fires.
- **UX rough edges.** Native `window.confirm` for delete, no "select all", no shift-click range, no Esc-to-clear, selection lost when switching list ↔ board (parent state is fine but bar rerenders visibly), sticky-top bar overlaps the toolbar, and raw `<input type=checkbox>` on board vs shadcn `Checkbox` on list looks inconsistent.

## What I'll change

### 1. Kill the re-render storm (biggest perf win)
- Wrap `TaskRow` and `BoardTaskCard` in `React.memo`.
- Change the row API from `onToggleSelect: () => void` to `onToggleSelect: (id, e?) => void` and pass one stable callback from the parent (via `useCallback` with empty deps, using a functional `setSelected`). Same for `selected` — pass the boolean, but the parent's `toggleSelect` reference is stable so memo works.
- Result: toggling one checkbox only re-renders that row.

### 2. Batch bulk mutations
- Replace per-id loops in `BulkTaskActions` with single Supabase calls:
  - Status: `supabase.from("pm_tasks").update({ status }).in("id", ids)`
  - Assignee: same pattern with `assignee_id`
  - Delete: already batched
- Optimistic UX: clear the selection + close the bar immediately, fire `emitTasksChanged()`, toast on success, restore on error.

### 3. Selection UX upgrades
- Replace `window.confirm` in delete with the shadcn `AlertDialog` already used elsewhere.
- **Select all**: add a checkbox in each group header (list view) and column header (board view) that toggles every task in that group.
- **Shift-click range select** within a group (track last-clicked index per group in a ref).
- **Esc clears selection.**
- Standardize on shadcn `Checkbox` in both list and board (drop the raw `<input>` on board cards).
- Move the bulk bar from sticky-top to a **floating pill fixed at the bottom-center** (Linear/Asana pattern) — no more overlap with the toolbar, always visible while scrolling, easier to dismiss.

### 4. Quiet the console warning
Once rows are memoized, `AssigneePopover` stops receiving new prop identities every render, which resolves the "Maximum update depth exceeded" loop observed in the console.

## Files to touch

- `src/components/pm/collections/BulkTaskActions.tsx` — batched SQL, AlertDialog, floating layout, count-aware labels.
- `src/components/pm/project/TasksTab.tsx` — stable `toggleSelect(id)` + `selectRange(id, groupIds)` callbacks, group-header select-all, Esc handler, memoized rows, last-index ref per group.
- `src/components/pm/project/board/BoardTaskCard.tsx` — memoize, swap raw checkbox for shadcn `Checkbox`, accept `(id) => void` toggle signature.
- `src/components/pm/project/board/BoardColumn.tsx` — optional select-all-in-column checkbox in the column header (only when a `getColumnTaskIds`/`onSelectAll` prop is passed, so other consumers are untouched).

## Out of scope (per instructions)

No changes to auth, role/user switcher, or DB seeding. No schema changes.
