Establish a project-wide "every callout is a deep link" rule and wire up the existing offenders.

## Rule (saved to project memory)

Every CTA, alert/banner, and stat/metric tile in the PM app **must** be clickable and must navigate to the surface that contains exactly those items, with the matching filter pre-applied. No purely decorative numbers or info-only banners. Future components must follow this from the start.

## Mechanism — URL-driven chip filters

Extend `useChipFilters(viewKey)` to read query params on mount and apply them, so any link can deep-link into a pre-filtered Work Queue (or any other list view).

```
/pm?chips=overdue                       → "Assigned to me + Overdue" applied
/pm?chips=blocked
/pm?chips=assigned_to_me                → "My active"
/pm?section=unclaimed                   → scrolls to + highlights the Unclaimed section
/pm?workType=request                    → sets the Requests/Projects toggle
```

Add a small helper `buildQueueLink({ chips?, section?, workType? })` in `src/lib/pm/links.ts` so call sites don't hand-craft URLs.

`useChipFilters` change:
- On mount, if `?chips=a,b,c` is present, replace the active set with it (and persist).
- On mount, if `?workType=...`, sync into `useWorkTypeFilter` via a small effect inside Work Queue (read once, set, then strip the param).
- After consuming params, `history.replaceState` to clean the URL so reloads don't re-apply unintentionally.

## Surfaces to wire up now

1. **UnclaimedBanner** — banner body becomes a `<Link to={buildQueueLink({ section: "unclaimed" })}>` wrapping the count/text. Keep the "View queue →" button. Clicking scrolls to the unclaimed section on `/pm`.
2. **Work Queue StatCards** (`My active`, `Unclaimed`, `Overdue (mine)`, `Blocked`)
   - `My active` → `?chips=assigned_to_me`
   - `Unclaimed` → `?section=unclaimed`
   - `Overdue (mine)` → `?chips=assigned_to_me,overdue`
   - `Blocked` → `?chips=blocked`
   - Convert each `StatCard` to a button/Link wrapper with hover state.
3. **Red overdue/blocked alert card** on Work Queue — split into two clickable segments linking to the corresponding chip combos.
4. **Project Detail header counters** (overdue/at-risk/idle health pill, unclaimed count on `ProjectWorkCard`) — clicking filters that project's Tasks tab via the existing role-pills + Me-mode mechanism. Add a `?taskFilter=overdue|blocked|unclaimed` reader on the Tasks tab.
5. **Section anchor scroll** — give each `<Section>` in Work Queue `id="section-<key>"` so `?section=unclaimed` can `scrollIntoView` after render.

## Out of scope (call out, do not build now)
- Roadmap (Legacy) `/roadmap/*` surfaces — rule applies going forward but no retrofit this pass.
- Workload / Global Timeline stat strips — flag as TODO follow-up; will wire in a separate pass.

## Files to touch
- `src/hooks/useChipFilters.ts` — URL-param ingestion
- `src/hooks/useWorkTypeFilter.ts` — same
- `src/lib/pm/links.ts` — **new** helper
- `src/pages/pm/WorkQueue.tsx` — StatCards become links, alert card clickable, sections get ids, consume `?section`
- `src/components/pm/UnclaimedBanner.tsx` — wrap content in link
- `src/pages/pm/ProjectDetail.tsx` + `src/components/pm/collections/ProjectWorkCard.tsx` — wire counter clicks
- `mem://design/clickable-callouts` + index update — persist the rule

## Memory entry (will be written)
> **Clickable callouts rule** — every CTA, alert/banner, and stat tile MUST link to the matching filtered view. Use `buildQueueLink()` from `src/lib/pm/links.ts`. `useChipFilters` and `useWorkTypeFilter` ingest URL params on mount; Work Queue sections expose `id="section-<key>"` anchors.
