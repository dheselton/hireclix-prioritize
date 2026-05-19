## Goal

Replace the current `TaskWorkspace` layout (`/pm/tasks/:id`) with a focused full-page work surface that matches the spec exactly: header with breadcrumb + colored title + monospace timer pill, two-column body (1fr / 300px), and a precise section order. No side drawer for this view — `?task=` Quick Edit drawer continues to exist separately for inline edits.

---

## New header

```text
[← Back]   Projects / [Client] / [Phase]                            [01:24:42  ■]
[●] Task title (20px, color from task type)                         [Quick edit]
```

- **Breadcrumb** (small muted): `Projects / {Client name} / {Phase name}`. Load `pm_projects.client_id → clients.name` and `pm_tasks.phase_id → pm_project_phases.name` (already have project; fetch client + phase in the same effect). Project name links to `/pm/projects/:id`.
- **Title row**: colored dot/icon (existing track/type color tokens from `src/index.css` — `--track-production`, `--track-pm`, etc., or task-type colors), then editable 20px title (inline edit on blur, same patch flow as today).
- **Timer pill** (right, persistent on this page): pill-shaped container with
  - monospace `tabular-nums` running clock `HH:MM:SS`
  - red square Stop button (icon-only, white Square fill)
  - When no active timer for this task → show a slim Play button inside the same pill shell so layout doesn't jump.
  - Reuses `useActiveTimer()` from `ActiveTimerProvider`; rewrite `TimerControls` styling to the pill design, keep behavior.

---

## Body: two-column grid `1fr 300px`

Use `grid-template-columns: minmax(0,1fr) 300px` at `lg+`, stack on mobile.

### Left column (in this exact order)

1. **Asset Hub (Uploads)**
   - Header: `ASSET HUB (UPLOADS)` muted uppercase + right-aligned `+ Upload assets` link button (triggers existing file picker).
   - Grid: `repeat(auto-fill, minmax(120px, 1fr))`, square cards (`aspect-square`), subtle border, muted bg, filename as placeholder centered when no thumb; filename label below with `truncate`.
   - Image-type files render a thumbnail (uses `pm_attachments.url`, already public via `task-attachments` bucket); others show extension text.
   - Final cell: dashed-border drop zone with `+` icon and "Drop files" label; drag-and-drop handlers reuse the existing upload pipeline in `AttachmentsSection`.
   - Built as `AssetHub.tsx`, extracted from `AttachmentsSection.tsx` (keep `AttachmentsSection` for the project detail page, share an `uploadFiles()` helper).

2. **Reference Links**
   - Header: `REFERENCE LINKS`.
   - Each row: 32px colored icon square left (provider-derived from URL — Figma `#F24E1E "F"`, GitHub `#24292F "G"`, Loom `#625DF5 "L"`, default neutral `🔗`), then title + URL muted small, external-link icon right. Whole row links out (new tab). Hover: border tints `hsl(var(--info))`.
   - Add-link inline form at bottom (label + url + add).
   - Built by restyling existing `LinksSection.tsx` — keep data layer, swap presentation. Add provider detection helper `getLinkProvider(url)`.

3. **Collab Hub** (comments)
   - Header: `COLLAB HUB`.
   - Reuse `CommentsThread.tsx` data; restyle to: avatar circle + bubble (`bg-muted rounded-lg p-3`), header row `<b>Name</b> · timestamp (muted, right)`, body text below.
   - Composer at bottom: current user avatar + textarea (`Write a comment or tag @team…`) + right-aligned `Post Comment` primary button.

### Right column — sticky `300px` sidebar

1. **Control Panel** card
   - Header `CONTROL PANEL`.
   - Rows separated by `border-b border-border/60`, last row no border. Each row: muted 12px label left, 13px bold value right.
   - Fields: Status (badge — info color), Priority (badge — warning for High), Assignee (avatar + name), Due Date (mm/dd/yyyy), Environment (`task.dev_environment` shown for dev tasks, hidden otherwise).
   - Refactor existing `ControlPanel.tsx` to this row layout. Inline editors still trigger on click (popover/select) — keep current edit affordances.

2. **Quick Checklist** card
   - Slightly different bg: `bg-secondary/40` with `border-2 border-border`.
   - Header `QUICK CHECKLIST`.
   - Reuse `ChecklistSection.tsx` data; restyle to compact checkbox rows; completed items get `line-through text-muted-foreground`.
   - Inline "+ Add item" input at bottom.

3. **Collapsed sections** (accordion, closed by default)
   - `Show Dependencies` → expands `DependenciesSection`.
   - `Show Design Rounds` → expands `DesignRoundsSection` (only when `task.type === "design"`).
   - Row design: full-width button, label left, `ChevronDown` right; rotates 180° when open. Use Radix `Accordion`.

---

## Sections that get removed/moved

The spec explicitly lists what shows on the page. To match exactly:

- **Description, Subtasks, FormSubmissionBlock, TimeTrackingSection, separate Dev Status Log, separate Blocker editor** → removed from this page. Description, subtasks, dev blocker, and dev environment remain editable via the existing **Quick edit** drawer (`?task=` route on Work Queue/Board) and the project detail view. `FormSubmissionBlock` content (if the task came from a public form) moves into a small **"From form"** badge in the breadcrumb area — clicking it opens the submission in the Quick edit drawer.
- **`BlockerBanner`** stays at the very top of the left column when `status === "blocked"` (it's a passive alert, not a section).
- **`TimeTrackingSection`** is fully removed — the header timer pill is the time tracking UI per the spec. Logged time entries are still queryable elsewhere (Workload/reports) and still written by the existing stop-timer flow.

---

## Files

**New**
- `src/components/pm/workspace/AssetHub.tsx`
- `src/components/pm/workspace/CollabHub.tsx`
- `src/components/pm/workspace/QuickChecklist.tsx`
- `src/components/pm/workspace/CollapsedSections.tsx`
- `src/components/pm/workspace/TimerPill.tsx`
- `src/lib/pm/linkProvider.ts` (`getLinkProvider(url)` → `{ initial, color, label }`)

**Edited**
- `src/pages/pm/TaskWorkspace.tsx` — new layout, fetch client+phase, remove old sections.
- `src/components/pm/workspace/ControlPanel.tsx` — row-style refactor.
- `src/components/pm/workspace/LinksSection.tsx` — restyle to colored icon rows.
- `src/components/pm/drawer/CommentsThread.tsx` — minor styling pass to match Collab Hub bubble design (keeps drawer use intact via a `variant` prop).
- `src/components/pm/drawer/ChecklistSection.tsx` — add `variant="quick"` prop for the secondary-bg compact look.

**Unchanged**
- `ActiveTimerProvider`, `FloatingTimerTray` (still floats on other routes), Quick edit drawer.

---

## Technical notes

- Colored title icon uses the existing track color token mapped from `task.track` (or fallback to type color). Component: a 10px circle.
- Timer pill: persistent only on this page; `FloatingTimerTray` is suppressed when the route is `/pm/tasks/:id AND the active timer is this task` to avoid duplication (check current pathname inside `FloatingTimerTray`).
- Breadcrumb fetch adds two extra queries on mount; batched in `Promise.all` with the existing project lookup.
- Drop zone uses the existing `pm_attachments` insert path and `task-attachments` storage bucket — no new buckets or RLS.
- All colors via semantic tokens (`--info`, `--warning`, `--muted`, `--border`); provider-icon background colors are inline hex per the spec (Figma `#F24E1E`, GitHub `#24292F`, etc.) but the icon-square component is themed.
