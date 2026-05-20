## Problem

The current Page Groups flow assumes the PM knows which pages exist at project creation. In reality, pages are discovered during Discovery — sometimes weeks after kickoff. Forcing a list upfront creates fake placeholders or blocks project start. **And** when pages are deferred, the timeline must still reserve enough working time across **both Design and Build phases** so adding pages later doesn't push Go-Live.

## Solution: Defer page definition, reserve time in every phase the pages touch

Treat page groups as **empty containers** at project start. The spine (Discovery → Strategy → Design → Build → QA → Launch) schedules immediately, with **phase-level reserved time blocks** held open for each page group in *every* phase its slot tasks belong to.

### 1. Wizard — skip the Pages step

- Remove "Pages" step from `TimelineSetupWizard`.
- Show info card: *"Pages will be added after Discovery. Design and Build time is reserved in the timeline."*
- Optional "I already know my pages" toggle reveals the current picker.

### 2. Template — per-phase reservations (key change)

In `TemplateBuilder`, each Page Group exposes:
- **`discovery_task_temp_id`** — fixed template task that gates page definition (e.g. "Sitemap Approval").
- **`reserved_by_phase`** — JSON map of `{ phase_name: days }`. Computed default = sum of slot-task durations per phase, multiplied by expected page count (PM sets `expected_page_count`, default 5).
  - Example for a "Content Page" group with Wireframe (2d), Design (3d), Build (4d), QA (1d) × 5 expected pages:
    ```
    { "Design": 25, "Build": 20, "QA": 5 }
    ```
- **`expected_page_count`** — drives default reservation math; editable per project.
- **`parallel_cap`** — max pages worked on concurrently per phase (prevents reservation from assuming infinite team capacity).

Reservations render on the Gantt as **striped ghost bars inside each phase swimlane**, labeled "Content Pages — Design (25d reserved, 0/5 defined)".

### 3. Scheduler — reservations as real constraints

Update `src/lib/pm/scheduler.ts`:
- Reserved blocks act as **fixed-duration phase placeholders** until pages are stamped.
- When a page is added mid-project, its real tasks **consume** matching reserved time in each phase (Design tasks eat Design reservation, Build tasks eat Build reservation).
- If real tasks exceed the reservation → cascade forward, surface a warning banner: *"Build phase over reservation by 4 days — Go-Live impacted."*
- If under reservation when group marked complete → reclaim slack, optional pull-in toast.
- Critical path treats reservations as on-path until consumed.

### 4. Project Pages tab

New **Pages** sub-tab on `ProjectDetail`:
- Card per Page Group: defined count vs. expected, **per-phase reservation usage bars** (Design: 12/25d used, Build: 8/20d used), "Add page", "Adjust expected count", "Mark group complete".
- Banner on Discovery completion: *"Discovery done — define pages for [Group]"* → opens `AddPageDialog`.
- Adjusting `expected_page_count` recomputes reservations and runs cascade through `CascadeConfirmModal`.

### 5. `AddPageDialog` improvements

- Multi-paste (one page name per line → N pages at once).
- Clone-from-existing-page (duplicates tasks + assignees).
- Per-page duration multiplier (Personas = 1.5×).
- Live preview of remaining Design/Build reservation after the add.

### 6. Help page

Rewrite Section 7 around the new flow, including how Design and Build reservations are computed, consumed, and recovered.

## Technical Details

**Schema (one migration):**
- `pm_template_page_groups`: add `discovery_task_temp_id text`, `reserved_by_phase jsonb default '{}'`, `expected_page_count int default 5`, `parallel_cap int`, `allow_late_definition boolean default true`.
- `pm_projects`: add `page_group_overrides jsonb default '{}'` (per-project expected counts / phase reservations), `pages_locked_at timestamptz`.
- No changes to `pm_tasks`.

**Files to modify:**
- `src/components/pm/TimelineSetupWizard.tsx` — drop Pages step.
- `src/lib/pm/api.ts` `instantiateTemplateIntoProject` — don't expand groups; write reservation records per phase.
- `src/lib/pm/scheduler.ts` — reservation consumption, over/under detection, cascade hooks.
- `src/lib/pm/pageGroups.ts` — `computeReservedByPhase(group, count)`, `consumeReservation(group, addedTasks)`.
- `src/pages/pm/TemplateBuilder.tsx` — per-phase reservation editor + expected count + parallel cap.
- `src/pages/pm/ProjectDetail.tsx` — new Pages tab route.
- `src/components/pm/project/PagesTab.tsx` (new) — group cards with per-phase usage bars.
- `src/components/pm/project/AddPageDialog.tsx` — multi-paste, clone, multiplier, live reservation preview.
- Gantt component — ghost bars per phase per group; consumption animation.
- `src/pages/pm/Help.tsx` — Section 7 rewrite.

**Backwards compatibility:** existing projects keep their stamped pages; new behavior only triggers for new projects or when a PM resets a group to "empty/reserved".

## Out of scope

- Auto-detecting pages from form submissions or sitemaps.
- Client-facing page-approval portal.
- Per-page subtask checklists beyond existing task support.
