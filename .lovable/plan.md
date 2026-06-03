## Goal
Make board and kanban cards scannable at a glance so users can instantly tell who owns an item, its exact status (unclaimed / claimed / in-progress / etc.), and its priority — without opening detail panels.

## Files to change

### 1. `src/components/pm/project/board/BoardTaskCard.tsx`
- Add a compact `StatusPill` (actual status: Unclaimed, Claimed, In Progress, Blocked, etc.) next to the title row so the specific state is visible inside grouped columns.
- Move the primary assignee avatar to the top-right of the card (or inline with the title) so ownership is immediately visible. Keep the team `AvatarStack` in the bottom row but muted/secondary.
- Keep the existing `PriorityFlag` and `StatusPickerPopover` (interactive group changer) — add signals, don’t remove interaction.
- Preserve existing card spacing, border treatments (careersite / internal / unclaimed amber), and hover lift.

### 2. `src/pages/pm/Work.tsx` — kanban inline cards
- Replace the plain-text `{t.priority}` badge with `PriorityFlag`.
- Add a `StatusPill` to each inline kanban card so status is reinforced even though cards live inside status columns.
- Make the assignee area clearer: show the primary owner avatar prominently and keep the full team stack as a secondary inline element.

## Out of scope
- No data model or API changes.
- No changes to list/grid/project modes.
- No new components — reuse existing `StatusPill`, `PriorityFlag`, `UserAvatar`, `AvatarStack`, and `MultiAssigneeChip`.

## Success criteria
- A user scanning the board can answer "who owns this?", "is this unclaimed?", and "what priority?" without clicking into any card.
- Visual density stays roughly the same — no card grows taller by more than one line.