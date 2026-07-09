## Goal
Produce a standalone document that explains what this application is, who it's for, how it's used, and how it works under the hood — suitable for onboarding new team members or sharing with stakeholders.

## Deliverable
A single `.docx` written to `/mnt/documents/HireClix-PM-Overview.docx` and surfaced via a `<presentation-artifact>` tag so you can preview/download it directly.

Format: Word doc (easy to edit, share, and paste into a wiki). If you'd prefer PDF or Markdown instead, say the word.

## Document outline

1. **What it is** — One-paragraph elevator pitch: an internal Agency Project Management platform built for HireClix's creative, dev, strategy, and analytics teams, living at `/pm/*`, with the legacy HireClix Roadmap kept under `/roadmap/*`.
2. **Who it's for** — The role model: PM, Designer, Developer, Strategist, Analyst, QA, CSM, Support, Submitter. Explains multi-role users (e.g. PM+Designer+Dev) and how access is the union of all assigned roles.
3. **Core principles** — Every stat/CTA/alert is a clickable deep link; date format mm/dd/yyyy; "actionable = important"; non-overwhelming daily view.
4. **The main surfaces** — Short description of each nav item:
   - `/pm` Daily Briefing (hero + Quick Tasks / Project Work / Notes)
   - `/pm/work` Work Queue (list / projects / kanban / grid modes — the canonical "see everything" view)
   - `/pm/workload` capacity view
   - `/pm/timeline` global Gantt
   - `/pm/time` Timesheet (weekly grid + entries, PM can view team)
   - `/pm/forms` public + internal intake forms
   - `/pm/templates` reusable project blueprints with page groups
   - `/pm/integrations`
   - `/snippets` code snippet library (Dev + Design only) with broken-snippet incident workflow
5. **Key workflows** — Walk through the lifecycle:
   - Intake (Quick Request or Public Form → attachments persist at project level → unclaimed task → someone claims it)
   - Project creation from a template (auto-copies tasks, deps, snippets; page-group reservations)
   - Scheduling (Configure Timeline → cascade confirm modal, critical path highlighted, reveal modes hide upcoming tasks in the UI without breaking scheduling)
   - Task workspace (right-rail TimeTracker, TaskMetaCard, RequestContextPanel, Dependencies, Snippets)
   - Time tracking (one global running timer, floating tray, timesheet grid)
   - Career Site Support mode (finished projects flip into ongoing support with Documentation tab)
6. **Visual language** — Internal (purple) vs Career Site (teal) accents; unclaimed amber glow; project team AvatarStacks; in-app attachment previews (image/pdf/video/office).
7. **How it works technically** (short section, plain language) — React + Vite + Tailwind + shadcn; Lovable Cloud backend with `pm_*` tables and RLS; auth currently disabled in dev via a TopBar role switcher, flip-ready for real auth via `VITE_PM_AUTH_ENABLED`; scheduler and permission helpers live in `src/lib/pm/`.
8. **Roadmap / not yet built** — Admin UI for editing user roles, tightened RLS once auth re-enables, transactional email wired to per-request-type aliases.

## Style
- Arial, US Letter, 1" margins, clean headings, bullet-heavy for scanability
- HireClix-neutral (no color branding assumed) — dark headings, light body
- Under ~5 pages so it stays readable
