
# RAID Log UX Refinement

Goal: Keep Decisions and Risks as first-class `pm_tasks` rows (already implemented) but present them so they're **visible without cluttering** the task board. Governance items get their own vocabulary, home strip, and global surfacing — so nobody has to remember to "check the RAID log."

No schema changes. Everything continues to ride on `pm_tasks.custom_fields`.

---

## 1. Project Tasks board — hide by default, add RAID strip

**TasksTab (`src/components/pm/project/TasksTab.tsx`)**
- Filter decisions/risks out of the board columns by default.
- Add a new **`RaidStrip`** component rendered above the board when there are any open decisions/risks on the project.
- The existing Kind filter chips get a new default state — "Tasks only" — with a "Show RAID inline" toggle that flips visibility back on.

**RaidStrip layout**

```text
┌─ RAID  ────────────────────────────────────────────────────────────────┐
│  2 Decisions pending · 1 Risk open                        [ + Log ▾ ]  │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌────────────────┐  │
│  │ ◆ CNAME: www vs apex │ │ ◆ Font licensing?    │ │ ⚠ Possible re… │  │
│  │  Owner: JT · 3d      │ │  Owner: MK · 1d      │ │  Sev: High · 5d│  │
│  └──────────────────────┘ └──────────────────────┘ └────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

- Compact horizontal chip row (scrollable). Each chip: kind icon, title (truncated), owner avatar, age.
- Chip click → opens TaskWorkspace (same as any task).
- Header count is clickable → jumps to `/pm/work?project=<id>&kind=decision,issue` (via `buildQueueLink`).
- "+ Log" split button → New Decision / New Risk (pre-fills `kind` in NewTaskDialog).
- Closed decisions and mitigated/closed risks drop out of the strip but remain in the board when Kind filter is flipped.

## 2. Kind-specific statuses (display only)

Underlying `pm_tasks.status` stays untouched so scheduler, filters, and existing groups keep working. We map per-kind labels on top:

| Kind     | UI label       | Underlying status |
|----------|----------------|-------------------|
| Decision | Pending        | `unclaimed` / `claimed` / `in_progress` |
| Decision | Decided        | `complete` |
| Risk     | Open           | `unclaimed` / `claimed` |
| Risk     | Monitoring     | `in_progress` |
| Risk     | Mitigated      | `complete` |
| Risk     | Closed         | `approved` |

- Add `getKindStatusLabel(kind, status)` and `getKindStatusOptions(kind)` to `src/lib/pm/taskKind.ts`.
- `StatusPill` and `StatusPickerPopover` accept an optional `kind` prop; when set, render the kind's vocabulary and picker options.
- Applied everywhere a decision/risk renders: BoardTaskCard, ProjectTaskCard, TaskWorkspace ControlPanel, RaidStrip chips.

## 3. Risk-specific fields (RAID details panel)

For `kind === "issue"` (Risk) — stored in `custom_fields.raid`:

- `severity`: Low / Medium / High / Critical
- `likelihood`: Low / Medium / High
- `mitigation`: rich text (short)
- `impact`: rich text (short)

For `kind === "decision"` — stored in `custom_fields.raid`:
- `decision_needed_by`: date (falls back to task due_date)
- `options`: list of short strings ("www", "apex")
- `decision_made`: text (filled when Decided)

Rendered as a new **`RaidDetailsCard`** in TaskWorkspace right rail (above TaskMetaCard) — only appears when kind ≠ "task". Editable inline.

## 4. NewTaskDialog updates

- Reorder: Kind selector moves above Title (choice drives what the form looks like).
- When Decision is selected: Title label becomes "Decision to make", show "Options" repeater and "Needed by" date.
- When Risk is selected: show Severity + Likelihood pickers.
- Files/Checklist/Deps sections stay collapsed for RAID items (rarely needed) but remain available.

## 5. Global surfacing

**Daily Briefing (`/pm`)**
- New callout tile in the hero row: **"RAID needing attention"** — counts pending decisions >3 days old and open High/Critical risks across projects the user can see.
- Clickable → `/pm/work?kind=decision,issue&stale=true`.
- Added via `src/lib/pm/briefing.ts` fetcher, rendered in `DailyBriefingHero`.

**KpiStrip on project (`src/components/pm/project/KpiStrip.tsx`)**
- Add one stat: **"RAID"** showing `{decisionsPending} · {risksOpen}` with the RAID icon.
- Clicks scroll to the RaidStrip (same page) — or opens the RAID inline view via the Kind filter.

**Global /pm/work**
- No new UI; the existing Kind filter already exposes Decision/Risk. Confirm the URL param `kind=decision,issue` works from external deep links.

## 6. Files to touch

**New**
- `src/components/pm/project/RaidStrip.tsx` — strip + chips + Log button
- `src/components/pm/workspace/RaidDetailsCard.tsx` — right-rail card
- `src/components/pm/tasks/RaidLogButton.tsx` — split "Log Decision / Log Risk" button (reused in strip + KpiStrip)

**Edited**
- `src/lib/pm/taskKind.ts` — kind-specific status maps, RAID helpers, type defs for `custom_fields.raid`
- `src/components/pm/project/TasksTab.tsx` — default-hide RAID, mount RaidStrip, kind filter default
- `src/components/pm/StatusPill.tsx` — accept `kind` prop
- `src/components/pm/project/board/StatusPickerPopover.tsx` — kind-aware options
- `src/components/pm/project/board/BoardTaskCard.tsx` — kind-aware StatusPill
- `src/components/pm/collections/ProjectTaskCard.tsx` — same
- `src/components/pm/workspace/ControlPanel.tsx` — kind-aware status vocabulary
- `src/pages/pm/TaskWorkspace.tsx` — mount RaidDetailsCard for RAID kinds
- `src/components/pm/project/NewTaskDialog.tsx` — kind-first ordering, conditional fields
- `src/components/pm/project/KpiStrip.tsx` — RAID stat tile
- `src/lib/pm/briefing.ts` — RAID-needs-attention fetcher
- `src/components/pm/workqueue/DailyBriefingHero.tsx` — RAID callout tile

## 7. Non-goals

- No changes to the scheduler, Workload, or Gantt (RAID rows still count as tasks there).
- No separate `pm_raid_items` table — everything stays on `pm_tasks`.
- No global "RAID page" — surfaced via Briefing + project strip only.

---

**End state:** the board stays clean, the RAID strip keeps governance items in peripheral vision at all times, decisions/risks speak their own language, and the Briefing pulls the stale/high-severity ones forward automatically.
