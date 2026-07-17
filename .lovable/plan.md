## Goal

When a career-site project reaches its `go_live_date` (and hasn't already been flipped), prompt the PM to transition it into Support mode with one click — instead of relying on them to remember the manual "⋯ → Enter Support mode" action.

## Scope

Only career-site projects (those in `useCareerSiteProjects()`), only PM-equivalent roles (PM / Alt PM / BA / Tech Lead), only when `custom_fields.support_mode_at` is not already set.

## Trigger conditions

A project qualifies for the prompt when ALL are true:
- Client/project is on the career-site request-type list
- `go_live_date` is set AND `go_live_date <= today`
- `custom_fields.support_mode_at` is null/undefined
- Current user has PM-equivalent permissions on the project
- User hasn't dismissed the prompt for this project (session-scoped)

## UX surfaces

**1. ProjectHeader banner (primary)**
A dismissible amber/teal banner directly under the header on `/pm/projects/:id`:
> "This project went live on 08/01/2026. Ready to transition to Support mode?"
> [Enter Support mode] [Not yet]

Uses the same handler already wired in `ProjectHeader.tsx` (writes `support_mode_at`), extracted into a small `useEnterSupportMode(project)` hook so both the banner and existing dropdown share one code path.

**2. Daily Briefing callout (secondary)**
On `/pm` (Briefing hero row), add a "Ready for Support handoff" tile when the current PM owns 1+ qualifying projects. Clicking deep-links via `buildQueueLink({ base: "/pm/projects/:id" })` to the first project, matching the app-wide "every stat is clickable" rule.

**3. Dismissal**
"Not yet" stores `{projectId, dismissedUntil}` in `localStorage` for 7 days so we don't nag daily. Entering Support mode clears the entry.

## Files to touch

- `src/lib/pm/supportMode.ts` (new) — `useEnterSupportMode`, `isReadyForSupport(project, isCareerSite)`, `useProjectsReadyForSupport()`, dismissal helpers
- `src/components/pm/project/ProjectHeader.tsx` — refactor handler to use the hook; unchanged UI
- `src/components/pm/project/SupportReadyBanner.tsx` (new) — banner component
- `src/pages/pm/ProjectDetail.tsx` — render `<SupportReadyBanner />` above tabs when qualifying
- `src/pages/pm/WorkQueue.tsx` (Briefing) — add "Ready for Support handoff" tile in hero
- `src/lib/pm/briefing.ts` — export `useProjectsReadyForSupport` or wire helper for the tile count

## Explicitly out of scope

- No auto-flip (user chose "auto-prompt", not "auto-flip")
- No changes to the exit-Support-mode flow
- No changes to which projects qualify as career-site (still uses existing `useCareerSiteProjects`)
- No schema changes — `support_mode_at` already lives in `custom_fields`
