## Work Queue Refactor — The Clarity Layer

Rebuild `/pm` (WorkQueue.tsx) around a three-band story: **Inbox (unclaimed) → My Active Work → Blocked & Review**, with Requests and Projects visually and structurally separated. Role drives which bands render.

### 1. New page structure

```text
┌─ Smart stats (4 tiles, role-aware) ────────────────────────┐
├─ INBOX (Unclaimed)  — 2-column grid                        │
│   • Quick Requests Inbox      • New Project Tasks          │
│     (unclaimed requests, my   (unclaimed project tasks,    │
│      lane)                     my lane)                    │
├─ MY ACTIVE WORK — tabs or 2-col, collapsible per side      │
│   • Quick Hits (my request tasks)                          │
│   • Project Work (my project tasks, grouped by project)    │
├─ BLOCKED & REVIEW                                          │
│   • Blocked Work (mine, shows blocker text)                │
│   • Waiting for Review (PM: in_review across their         │
│     projects / Execution: my submitted in_review)          │
└────────────────────────────────────────────────────────────┘
```

Role variants:
- **Designer / Developer**: all 3 bands as above, lane-filtered (designer = design+content, dev = dev+qa).
- **PM**: Inbox shows Unclaimed Requests + Unclaimed Project Tasks (all lanes). Replace "Quick Hits" with **Project Health** (list of PM's projects flagged with overdue / blocked / at-risk counts, each row deep-links to the project). Keep "Project Work" (PM's own assigned tasks) and Blocked + Approvals Waiting on Me.
- **Strategist / Analyst**: same as Designer/Developer but lane = their specialty.
- **Submitter**: only **My Requests** (created_by = me) grouped by status — no inbox / blocked bands.

### 2. Card design split

Two new presentational components in `src/components/pm/collections/`:

- **`RequestTaskCard.tsx`** (compact): single row, thin border, `py-2 px-3`, no shadow.
  - Line 1: title (sm font) + `Request` badge + `StatusPill`.
  - Line 2 (muted, text-[11px]): client name · due date · assignee avatar.
  - Inline `ClaimButton` when unclaimed.

- **`ProjectTaskCard.tsx`** (rich): standard card with subtle shadow, `p-4`.
  - Line 1: **Project title** (bold) + `Project` badge + phase chip.
  - Line 2: task title (medium) + `StatusPill` + priority dot.
  - Line 3 (muted): client · due date · assignee · resume hint if applicable.
  - Footer: "Open project" link + claim/open task buttons.

Both render in a 1-col stack inside their section; project cards group by project_id with a tiny project header above consecutive cards from the same project (so we don't repeat the project line). The existing `ProjectWorkCard` keeps its role in `/pm/projects` views but is **not** used in the new WorkQueue bands except optionally inside "Project Health" for PMs.

### 3. Smart header stats (role-aware)

Replace the four `StatCard`s with:

| Tile | Designer/Dev/Strategist/Analyst | PM |
|------|---|---|
| Active Requests | count of my active request tasks | count of unclaimed requests across all lanes |
| Active Projects | distinct project_ids I have active tasks in | count of PM's active projects |
| Total Unclaimed | unclaimed in my lane | unclaimed everywhere |
| Blockers | my blocked tasks | tasks blocked across PM's projects |

Each tile remains a deep-link via `buildQueueLink` (existing rule). Hide stats entirely for Submitters.

### 4. Section controls

- `CollapsibleSection` wrapper (uses existing `@radix-ui/react-collapsible`) for each band's left/right columns. State persisted in `localStorage` under `pm.workQueue.collapsed.<key>`.
- "Me Mode" already filters tasks globally — keep behavior; sections continue to use the `filtered` pipeline.
- Existing chip bar, type filter, work-type toggle, and view-mode toggle stay in the toolbar but the **view-mode dropdown is removed** for the new layout (the structure IS the view). Power users can still hit `/pm/board` for kanban.

### 5. Data plumbing

No schema changes. All segmentation is derived in WorkQueue from existing fields:

- `isRequestTask(t)` = parent project `work_type === 'request'` (helper already present).
- `isProjectTask(t)` = parent project `work_type === 'project'` or null.
- `inLane(t)` from `ROLE_LANE` map (already present, kept).
- `active(t)` = not complete/approved.
- `blocker text` from `t.dev_blocker` (already on `pm_tasks`).
- "Waiting for Review" for execution roles = tasks where `t.created_by === meId && t.status === 'in_review'`. For PMs = `t.status === 'in_review' && pmProjectIds.has(t.project_id)` (existing logic, kept).
- "Project Health" for PMs uses `fetchTasks` + `fetchProjects` (already loaded) — group by project, compute overdue/blocked counts inline.

### 6. Files

**New**
- `src/components/pm/collections/RequestTaskCard.tsx`
- `src/components/pm/collections/ProjectTaskCard.tsx`
- `src/components/pm/CollapsibleSection.tsx` (small wrapper with persisted open state, count badge, optional right-side action slot)
- `src/components/pm/workqueue/InboxBand.tsx` (renders the two unclaimed columns)
- `src/components/pm/workqueue/ActiveWorkBand.tsx` (Quick Hits + Project Work, or Project Health for PMs)
- `src/components/pm/workqueue/BlockedReviewBand.tsx`
- `src/components/pm/workqueue/ProjectHealthList.tsx` (PM only)

**Modified**
- `src/pages/pm/WorkQueue.tsx` — replace `sections.map` + ViewToggle modes with three band components. Keep toolbar, stats, banners, `CreateWorkDialog`, `TaskDrawer`, `?section=` scroll behavior (extend ids to new section keys: `inbox-requests`, `inbox-projects`, `quick-hits`, `project-work`, `blocked`, `review`, `project-health`).
- `src/lib/pm/links.ts` — extend `buildQueueLink` `section` union with the new keys (no behavior change).

**Unchanged**: filters pipeline, `applyTaskChips`, `applyTaskTypes`, `ROLE_LANE`, `useMeMode`, `useChipFilters`, `useWorkTypeFilter`, `CreateWorkDialog`, `TaskDrawer`. The `ProjectWorkGrid` / `ProjectWorkCard` and other view modes (list/grid/kanban) remain in place for `/pm/board` and project detail.

### 7. Out of scope

- No DB migrations, RLS, or auth changes.
- No edits to `/pm/board`, `/pm/projects`, project detail, templates, or scheduler.
- No new task fields; "blocker text" uses existing `dev_blocker`.
- No realtime additions beyond the existing `useTasksChanged` reload.
