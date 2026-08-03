# Make every stat a door: fix 8 dead-end numbers

The product rule is "every number is a door." Eight stat surfaces either don't navigate at all or navigate somewhere that ignores the filter. This plan wires them all up, adding the small amount of param handling the destination views need so the links actually land filtered.

## Foundation: project-scoped filtering

Today the project page (`/pm/projects/:id`) has no URL-driven tab or filter state, so a project-scoped link can't land on a filtered task list. Add that first:

- **ProjectDetail** reads `?section=` on mount and opens the matching tab (`tasks`, `qa`, `files`, ...), then strips the param.
- **TasksTab** gains a status filter driven by `?taskFilter=` with values `overdue | blocked | open | in_review | done`, plus support for the existing `?chips=` deep-link params (overdue / blocked / watching). The active filter shows as a removable pill above the board so users can see and clear it.

`buildQueueLink`'s signature stays unchanged; project-scoped callers pass `base: "/pm/projects/<id>"` and append `taskFilter` where a chip doesn't exist.

## The eight fixes

1. **KpiStrip (project header)** — Overdue and Blocked link to this project's filtered task list instead of the global queue. Open becomes a link to the project's open tasks.
2. **Overview "Start Here" callouts** — overdue, go-live, kickoff, in-review, and all-clear each land on the project's Tasks tab with the matching filter applied (all-clear goes to the unfiltered task list).
3. **Overview MiniMetrics** — Open and Done become buttons that navigate to the project-scoped filtered list. Progress stays plain text (it's a percentage, not a set of tasks).
4. **TaskMetaCard client link** — routes to `/pm/work` with the client tag pre-applied (`?tags=client:<slug>`), a filter the Work view already honors, instead of the dead `/pm/projects?client=` URL.
5. **UnclaimedBanner** — the "View queue" CTA becomes a real link: global unclaimed queue, or the project's unclaimed tasks when the banner is project-scoped.
6. **Daily Briefing "RAID needs attention"** — navigates to `/pm/work?section=raid`; Work honors `section=raid` by switching its list to open decisions and risks, with a clearable indicator.
7. **Team Workload** — clicking a person's name or avatar navigates to `/pm/work?user=<id>`; Work honors `?user=` by filtering to that person's tasks (primary and co-assignee) and shows a clearable "Viewing: <name>" pill.
8. **QA triage StatChips** — New / In fix / Ready to verify / Blockers become toggle buttons that filter the QA board client-side (no navigation); clicking the active chip clears it.

## Technical notes

- New params: `section` and `taskFilter` on the project route; `user` and `section=raid` on `/pm/work`. All are consumed on mount and stripped from the URL, matching the existing `useChipFilters` / `useTagFilter` pattern.
- `buildQueueLink` is untouched — only new callers using its existing `base` option.
- Co-assignee awareness for the `?user=` filter reuses the existing assignees map already loaded in Work.
- Files touched: `ProjectDetail.tsx`, `TasksTab.tsx`, `KpiStrip.tsx`, `OverviewTab.tsx`, `TaskMetaCard.tsx`, `UnclaimedBanner.tsx`, `DailyBriefingHero.tsx`, `Workload.tsx`, `Work.tsx`, `QaTab.tsx`.
