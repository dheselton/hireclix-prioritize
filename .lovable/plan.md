# Re-audit backlog — phased delivery

You asked to go one phase at a time without re-pasting the specs. Step one of this plan is to save the whole 13-item backlog into project memory so every future session already knows it. Then Phase 1 gets built.

## Phase map

| Phase | Item |
|---|---|
| 1 (now) | FIX-1 `?tab=` fallback + FIX-2 real project Timeline tab |
| 2 | Intake Triage Inbox (`/pm/inbox`) |
| 3 | "Since you last checked" activity digest on Daily Briefing |
| 4 | Team Report (`/pm/report`) |
| 5 | Workload per-person diagnosis chips |
| 6 | Bulk reschedule + list-row triage popover |
| 7 | Operational search (state tokens) |
| 8 | Public client status portal (`/status/:token`) |
| 9 | Recurring / scheduled work from templates |
| 10 | Watchers + targeted nudges |
| 11 | Time-entry suggestions from activity |

After each phase I mark it done in memory and offer the next one — you just say "next phase".

## Three corrections to the source prompts

Worth knowing before later phases:

- The search parser is at `src/lib/search/parseQuery.ts`, not `src/lib/pm/search/`.
- The clients table is `clients`, not `pm_clients` (matters for the recurring-schedules migration).
- There is no `TimeLogDialog`; time entry uses `EntryPopover` (`src/components/pm/time/`).

## Phase 1 — what gets built

### FIX-1 · Invalid `?tab=` handling

Today `ProjectDetail.tsx` validates `?tab=` against the full `ProjectTabId` union, so `?tab=qa` on a non-QA project is accepted, no QA tab renders in the strip, and the body renders nothing.

The fix computes the available-tab list first (it already exists further down the component: QA needs QA mode, Project Timeline and Pages need a non-request project, Pages also needs a template, Snippets needs a dev/designer role, Documentation needs support mode), then:

- If the requested tab is in that list, use it.
- If not, fall back to `tasks` and fire a toast naming the reason: "QA mode is not active on this project — showing Tasks instead.", "This project doesn't have a Pages tab.", and so on.
- The URL is rewritten to the fallback tab so a reshared link is honest.

The gating rules themselves are untouched.

### FIX-2 · Real project Timeline tab

Replaces the "(Phase 2)" placeholder card and drops the "Coming soon" badge.

New `ProjectTimelineTab` component:

- Uses the tasks already loaded by `ProjectDetail` — no extra fetch.
- Buckets tasks with a `due_date` into calendar weeks anchored on the project's `go_live_date`, labelled relative to it:

```text
Week of 01/13  (T-3 weeks)
Week of 01/20  (T-2 weeks)
Week of 01/27  (Go-live week)
Week of 02/03  (T+1 week)
No date set
```

- Each row: title, assignee avatar, status pill, whole row links to `/pm/tasks/:id`.
- Tasks with no due date collect in a "No date set" group at the bottom, with the count in the header so it reads as an action item.
- No `go_live_date` set: an empty state — "Set a go-live date to use the timeline." — with a link to the Overview tab where the date is edited.
- Read-only. No Gantt, no drag-and-drop.

## Technical notes

- Tab availability gets extracted into a small helper inside `ProjectDetail.tsx` so both the tab strip and the `?tab=` validator use one source of truth; the validation runs in an effect after `project` loads, since gating depends on project data that isn't there on first render.
- Week bucketing uses the existing local-date helpers and `fmtDate` (mm/dd/yyyy) — no `toISOString()` truncation.
- Reuses `StatusPill`, `UserAvatar`, and `useTaskDrawerLink().open()` rather than new components.
- Files touched: `src/pages/pm/ProjectDetail.tsx`, `src/components/pm/project/ProjectTimelineTab.tsx` (new). No schema changes.
