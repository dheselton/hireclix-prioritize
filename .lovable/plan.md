Wipe all seeded/demo PM data so the app starts clean.

What gets deleted (via a single migration using TRUNCATE ... CASCADE):
- All 16 projects in `pm_projects` (including "Acme Career Site Refresh", "Career Site — Resideo", "Test Career Site Project", "New NGA banner ads", etc.) and everything tied to them — tasks, subtasks, assignments, dependencies, comments, attachments, time entries, active timers, project members, project phases, page links, task snippet links.
- All 207 rows in `pm_tasks` (covers project tasks and standalone requests).
- All 6 sample clients (Acme Corp, Globex Inc, BrightSpring Health, The Container Store, Sheppard Pratt, Resideo).
- The 1 existing personal note in `pm_notes`.

What is preserved:
- Mock users (TopBar role switcher keeps working).
- Templates, page groups, snippets, forms, and integrations config.
- All schema, RLS, grants, triggers — structure untouched.

Technical approach:
- One migration that runs `TRUNCATE` with `CASCADE` and `RESTART IDENTITY` on the parent tables (`pm_projects`, `pm_tasks`, `pm_notes`, `clients`), letting FKs cascade to dependent tables. This is safer than hand-listing every child table and guarantees nothing is left orphaned.
- No app code changes needed — pages already render empty states.