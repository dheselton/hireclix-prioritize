# Career Site Support requests

Goal: support a new flavor of request that spans tiny fixes → multi-person mini-projects, without restructuring the Quick Tasks UX. They live in the same Quick Tasks column as today, but are visually denoted as Career Site work plus a sub-type pill (Bug fix, Content change, API / Job feed, New page, Scope-of-work project, General support).

## 1. New request type + sub-type

In `src/components/pm/CreateWorkDialog.tsx`:

- Replace the single `careersite_update` entry with a dedicated **Career Site** group at the top of `REQUEST_TYPE_GROUPS`, containing six new request types:
  - `careersite_bug` — "Bug fix"
  - `careersite_content` — "Content change"
  - `careersite_jobfeed` — "API / Job feed issue"
  - `careersite_new_page` — "New page design / build"
  - `careersite_sow` — "Scope-of-work project"
  - `careersite_support` — "General support"
- Add matching labels in `REQUEST_TYPE_LABELS` and extend the `RequestType` union in `src/types/pm.ts` (where it's defined).
- Keep the legacy `careersite_update` value as an alias that maps to `careersite_support` so existing rows still render.

These flow through the existing intake path unchanged — `custom_fields.request_type` already stores the value, `useInternalRequestForm()` already drives per-type field sets via `pm_forms` (`kind=internal_request`), and the request still becomes a Quick Task / project the same way it does today.

## 2. Per-type intake fields (DB)

Insert one `pm_forms` row per new type (`kind='internal_request'`, `request_type=<value>`) plus a small set of `pm_form_fields` so each sub-type asks for what it needs:

- Bug fix: Page URL, Steps to reproduce (textarea), Browser/device, Severity (select)
- Content change: Page URL, What needs to change (textarea), Final copy (textarea, optional)
- API / Job feed: ATS / feed source (select: iCIMS, Workday, Greenhouse, Other), Affected job(s) or feed URL, Symptom (textarea)
- New page: Page purpose, Target URL slug, Reference links, Copy doc link
- SOW project: SOW link, Estimated scope (select: S/M/L), Stakeholders (text)
- General support: What do you need (textarea)

Page URL / description / attachments / links already come from the shared intake pieces — no schema change needed; this is purely a data insert into `pm_forms` + `pm_form_fields`.

## 3. Visual treatment — Career Site teal

Add a new accent token alongside the existing `--internal` purple in `src/index.css`:

```text
--careersite: 188 70% 42%;          /* teal */
.careersite-border-l { border-left: 3px solid hsl(var(--careersite)); }
.careersite-pill     { background: hsl(var(--careersite) / 0.12); color: hsl(var(--careersite)); }
```

Add a helper `isCareerSiteRequest(custom_fields)` in `src/lib/pm/clients.ts` (next to the internal helpers): returns `true` when `custom_fields.request_type` starts with `careersite_`. Single source of truth, so cards stay consistent.

Apply the treatment in the four places request cards render today — **no new components**:

- `src/components/pm/workqueue/QuickTasksColumn.tsx` row
- `src/components/pm/collections/RequestTaskCard.tsx`
- `src/components/pm/collections/ProjectTaskCard.tsx` (when work_type === request)
- `src/components/pm/project/board/BoardTaskCard.tsx`

On each card:
- Left border becomes `.careersite-border-l` (takes precedence over the amber unclaimed border via class ordering — unclaimed amber dot moves into the meta row instead, see below).
- Add a small teal **CAREER SITE** pill plus the sub-type label (e.g. "CAREER SITE · Bug fix") into the existing meta row that already shows client + request type. No new row, no layout change.
- Internal (HireClix) + Career Site can co-exist: internal purple pill renders first, Career Site teal pill second. Border takes the Career Site teal when both apply, since that's the more actionable categorization for the team.

## 4. Quick Tasks column denotation

In `QuickTasksColumn.tsx` the existing per-row meta already shows client + request type chip. Change the request-type chip's styling to use `.careersite-pill` when `isCareerSiteRequest` is true, and prefix the label with the friendly sub-type (e.g. "Career Site · API / Job feed"). The unclaimed amber affordance becomes a small amber dot in the meta row (instead of the left border) when the row is Career Site, so the teal stroke stays visible.

No changes to filtering, sorting, claim flow, or which column the task lands in.

## 5. Workspace surfacing

`TaskMetaCard` (`src/components/pm/workspace/TaskMetaCard.tsx`) and `RequestContextPanel` already render `custom_fields.request_type` — they pick up the new values automatically. Add one line in `TaskMetaCard`: when `isCareerSiteRequest`, render the teal CAREER SITE pill next to the request type so the workspace matches the cards.

## Out of scope (intentionally)

- No new column, board lane, or filter for Career Site — the user explicitly wants this to fit existing UX.
- No change to how multi-person projects are structured. SOW-flavored requests are still created as a request (single task) by default; the team can convert to a project from the existing project conversion path if they need PM + multiple owners. We can add a one-click "Convert to project" affordance in a follow-up if it becomes a pain point.
- No change to scheduling, dependencies, or templates.

## Technical notes

- Files touched: `src/types/pm.ts`, `src/components/pm/CreateWorkDialog.tsx`, `src/lib/pm/clients.ts`, `src/index.css`, `src/components/pm/workqueue/QuickTasksColumn.tsx`, `src/components/pm/collections/RequestTaskCard.tsx`, `src/components/pm/collections/ProjectTaskCard.tsx`, `src/components/pm/project/board/BoardTaskCard.tsx`, `src/components/pm/workspace/TaskMetaCard.tsx`.
- One data migration via the insert tool: seed 6 `pm_forms` rows + their `pm_form_fields`.
- Memory update: add a Core line noting the Career Site accent token + sub-types so future work stays consistent with the internal/Career Site visual pattern.
