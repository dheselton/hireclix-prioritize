
## The problem

Every project hits a go-live QA phase where the client + their testing teams file dozens of tickets in short bursts. Today each one becomes a normal `pm_tasks` row mixed into the board, which:

- Buries build work under a flood of small bugs
- Has no lightweight bulk-entry path (New Task dialog is too heavy for 30 tickets)
- Offers no triage state (severity, reproducibility, "cannot reproduce", "duplicate")
- Doesn't give the client a simple place to submit + see status

## Proposal: QA phase on a project

Introduce a **QA / UAT mode** for a project (parallel to the existing Support mode), plus a new `qa` task kind alongside `task | decision | issue`.

### 1. Project-level QA mode

- PM flips project into "QA / Go-live testing" from `ProjectHeader` dropdown (same pattern as Enter Support mode). Stored as `pm_projects.custom_fields.qa_mode_at`.
- Auto-prompt banner when project passes go-live date (mirrors `SupportReadyBanner`).
- While in QA mode:
  - New **QA tab** on the project (between Tasks and Files) — the triage board for tickets only
  - Header shows "QA mode" pill + "Log QA ticket" button
  - Non-QA tasks collapse into a "Build" bucket the way Support mode collapses build tasks

### 2. New `qa` task kind

Extends `src/lib/pm/taskKind.ts`:

- `kind: "qa"` with red/pink accent, Bug icon
- Kind-aware status vocabulary: New → Triaging → Confirmed → In Fix → Ready to Verify → Verified → Won't Fix / Duplicate
- Custom fields under `custom_fields.qa`: `severity` (blocker/major/minor/cosmetic), `reproducibility` (always/sometimes/once), `environment` (URL/browser), `reported_by_name` (external tester name), `steps`, `expected`, `actual`, `resolution` (fixed / wont_fix / duplicate / cannot_reproduce), `duplicate_of` (task id)

### 3. Bulk intake — the core of the request

Two entry paths, both landing in the project's QA tab as `kind='qa'` tickets:

**a. Client-facing QA form** — a variant of the existing Quick Request form, scoped to one project via URL (`/f/qa/:projectId`). Fields tuned for bug reports (URL, browser, steps, expected/actual, screenshot). Every submission = one QA ticket, watchers notified, requester gets a shareable status link.

**b. Paste-to-tickets dialog** ("Log QA batch") — PM/BA pastes a list (numbered, bulleted, or line-per-ticket) from the client's email / spreadsheet / Slack; we split on newlines, show a preview table where each row is an editable draft (title, severity, page), then create all rows in one insert. Reuses the existing bulk insert path.

### 4. QA triage board

New `QaTab.tsx` — a focused board with columns matching the QA status vocabulary. Reuses `BoardTaskCard` + `BulkTaskActions` (already built) so PMs can:

- Multi-select and bulk-assign to a dev
- Bulk-mark as Duplicate / Won't Fix with a shared resolution note
- Filter by severity + reporter
- See a small header strip: `12 new · 8 in fix · 5 ready to verify · 3 blockers`

Each QA card shows severity chip, reporter name, and environment inline.

### 5. Client status view (optional, phase 2)

A read-only `/f/qa/:projectId/status` page listing the client's submitted tickets and their current QA status — no login needed, scoped by project id + submission token. Not required for v1; noted so we design for it now.

### 6. Daily Briefing hooks

- New callout: **"QA blockers — {n}"** deep-linking to `/pm/work?workType=all&kind=qa&severity=blocker`
- Project cards in QA mode get a red "QA" pill and blocker count

## Technical outline

```text
Schema (single migration)
  ALTER TYPE / no enum change — kind lives in custom_fields
  No new tables required in v1 — pm_tasks + pm_forms cover it

Files touched
  src/lib/pm/taskKind.ts          + "qa" kind, QA status labels, severity meta
  src/lib/pm/qaMode.ts            NEW: isQaMode, enterQaMode, exitQaMode
  src/components/pm/project/
    ProjectHeader.tsx             + Enter/Exit QA mode menu item + pill
    QaReadyBanner.tsx             NEW (mirrors SupportReadyBanner)
    QaTab.tsx                     NEW: triage board
    ProjectTabs.tsx               + conditional QA tab
    NewQaTicketDialog.tsx         NEW: single-ticket quick form
    QaBatchPasteDialog.tsx        NEW: paste → parse → preview → bulk insert
  src/pages/pm/PublicForm.tsx     + QA form variant scoped by projectId
  src/lib/pm/api.ts               + createQaTicketsBulk()
  src/components/pm/tasks/KindBadge.tsx  + qa styling
  src/pages/pm/ProjectDetail.tsx  + mount QaReadyBanner
  src/components/pm/workqueue/
    DailyBriefingHero.tsx         + QA blockers callout
```

No changes to auth, role switcher, or seed data.

## Open questions before I build

1. Should the client-facing QA form require the requester's email (so we can email them status changes), or stay fully anonymous like the current Quick Request?
2. For the paste-to-tickets dialog — do you want it to also accept a pasted spreadsheet (tab-separated: Title | Severity | Page), or is one-ticket-per-line enough for v1?
3. Should moving a project into QA mode auto-notify the whole project team, or stay silent?
