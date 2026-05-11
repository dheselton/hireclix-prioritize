
# Real Data + PM/Production Track UX

## 1. Team (final)
Added to `mock_users` on top of existing data, with `avatar_color` matching your screenshots.

**PMs (4)** — Drew Luster, Michael Norwood, Moe Hutt, Erika Atwood
**Designers (5)** — Heather Oxsen, Jillian Perrone, Veronica Funk, Amelia Beigel, Lisa Thompson
**Developers (2)** — Riley Mulligan, Lisa Thompson
**Both Designer + Developer** — Dan Heselton (you), Lisa Thompson

Since the schema has a single `role`, I'll add a `secondary_role` column so Dan and Lisa can carry both. The Track filter treats anyone with `designer` or `developer` (primary or secondary) as **Production**.

## 2. Clients & Career-Site Projects
Insert four `clients` and four `pm_projects` (type `career_site`, status `active`):
BrightSpring Health · The Container Store · Sheppard Pratt · Resideo. PMs are added as `pm_project_members` with role `pm`; designers/devs as `production`.

## 3. Career Site Template — full structure
One reusable template `pm_project_templates` named **"Career Site — Full Build"** with phases & tasks taken from your ClickUp screenshots:

```text
Pre-Kickoff Activities          → PM
  Schedule Meeting · Conduct Meeting
  PM Introduction Meeting (Schedule + Conduct)
  Initial Set Up (ClickUp Workspace, Project Plan, RAID Log,
    Google Chat Space, Career Site Drive folder)
Project Kickoff                 → PM
  Schedule Kickoff Call · Kickoff Call
Discovery                       → PM
  Discovery Call #1 (Provide EVP, Brand Guidelines, Inspiration)
Research Discovery              → PM
  Career Site Kick-Off Meetings · Site Map confirmation · Page speed testing
Concept Development             → Design
  Wireframes · Design Concepts R1 / R2 / R3
Figma Design                    → Design
  Meetings · Overarching Figma Set-Up · Client Corporate Design
  Editing Figma For Build · Gray Components Catalogue · etc.
Build                           → Dev
  Webflow Style Guide · Search page · Job Description Page
  Favorite Job · Second Chance · Recruiter Hub · Talent Community
  Sandbox Set-Up
API Connect                     → Dev
  ATS API Creds · Field Mapping · API Testing
  Build Job Search · Build JD Page · Additional CMS · Job Error Reporting
QA & Launch                     → PM + Dev
```

Each `pm_template_tasks` row carries `assignee_role` and `track` so instantiation routes work to the right people automatically.

Then **instantiate the template for all 4 clients**: full phases + tasks created, assignees populated round-robin within each role group, dates left blank (you set go-live and let the existing scheduler back-fill).

## 4. Sample Quick Requests
Convert the 6 visible cards from your second screenshot into real `pm_projects` of type `quick_request` with the assignees, due dates, priority, and CREATIVE-#### tag from the cards:
Lightcast Video · ASRC YouTube/Meta Video Ad (Orion) · Public Storage Search Terms · RGS Career Sites · GA4/GTM Checklist · Beyond + Career Site Concept.

Existing fake projects/tasks are **not deleted** — just sit alongside the real ones.

## 5. The Dual-Track UX — how PMs and Designers/Devs stay out of each other's way

**Concept:** every task carries a `track` — `pm` or `production` — auto-set from its assignee's role. Each user lands in their own track by default; one click to peek at the other.

### Toolbar (added to every collection view)
```text
[Title]  ···  [My Track | Other Track | All]  [Me|All]  [Filter]  [Sort]  [List|Grid]
```
- PMs default to "My Track" = PM tasks only.
- Designers/Devs default to "My Track" = Production tasks only.
- "Other Track" gives a read-friendly view of the other side (muted styling, a small "viewing other team" banner) — no accidental edits.
- "All" merges everything.
- Persists per-view in localStorage (same pattern as existing chip filters).

### Visual cues so the two never get tangled
- 3px **left border** on every task row/card colored by track (PM = indigo, Production = amber).
- Phase headers in Project Detail show a track tag.
- Workload page splits into two stacked panels: "PM Capacity" and "Production Capacity" — each user's own panel expanded, the other collapsed.
- Project Detail keeps one timeline but adds tabs: **Overview · PM Plan · Production · Files** — same data, pre-filtered.

### Why this works for your team
- Designers/devs open the app and see only Build / Design / QA work — no kickoff/RAID/meeting noise.
- PMs see planning and client-facing tasks only.
- Anyone can flip to "Other Track" to check status without changing assignments.
- Cross-team handoffs (Discovery complete → Wireframes start) still work via dependencies — the receiving team just sees the new task land in their track.

## Technical Details

### Schema (one migration)
- `mock_users.avatar_color text`, `mock_users.secondary_role text` (nullable).
- `pm_tasks.track text default 'production'` with CHECK in `('pm','production')`.
- `pm_template_tasks.track text` for templates.
- DB trigger: when `pm_tasks.assignee_id` changes, set `track` from that user's primary role (`pm` → `pm`, otherwise `production`). Manual override allowed.

### Data seeding (one `supabase--insert` script)
- 11 users, 4 clients, 1 template + ~50 template tasks, 4 instantiated career-site projects with phases/tasks/members, 6 quick-request projects.
- Nothing existing is deleted.

### Frontend
- `useTrackMode.ts` hook (mirrors `useMeMode`) — values `mine` / `other` / `all`, sessionStorage.
- `TrackToggle.tsx` segmented control inside `CollectionToolbar`.
- Extend `src/lib/pm/filters.ts` with `applyTrackFilter(tasks, mode, currentUserRoles)`.
- `UserAvatar.tsx`: use `avatar_color` when present.
- `TopBar` role switcher: show all 11 real users grouped (PMs / Designers / Developers / Both).
- Project Detail: Overview / PM Plan / Production / Files tab strip pipes into the existing task list.
- Workload: two `<TaskListView>` panels split by track.
- Subtle left-border treatment in `TaskListView` and `TaskGridView` via CSS vars `--track-pm` / `--track-production` in `index.css`.

### Out of scope
- Real auth (still mock-user switcher).
- Tightening RLS (still permissive).
- Auto-scheduling the seeded tasks (dates blank — you set go-live and the existing scheduler back-fills).
