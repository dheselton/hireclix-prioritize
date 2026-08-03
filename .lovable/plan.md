# Daily Briefing hero chips: RAID link + zero-count states

## Current state (verified)

The reported bug is already fixed in the codebase:

- `src/components/pm/workqueue/DailyBriefingHero.tsx` (line ~70) renders the RAID chip with `buildQueueLink({ section: "raid" })`, not a bare `/pm/work`.
- `src/pages/pm/Work.tsx` (lines 112-129) reads `?section=raid` on mount, sets `raidOnly`, and strips the param from the URL.

So Option B is already implemented and functional. The path referenced in the request (`src/components/pm/DailyBriefingHero.tsx`) does not exist.

## What's left to do

One real gap remains from the request: zero-count chips.

- The RAID and Blocked chips are hidden entirely at count 0 (fine).
- The **Overdue** chip always renders as a clickable `Link`, even when the count is 0 — clicking it lands on a filtered view with no results, which is the same "broken link" feel the request calls out.

Change: make the `Chip` component render as non-interactive muted text (no `Link`, no hover state) when its count is 0, and apply that to the Overdue chip. Quick Tasks / Active Projects chips get the same treatment at 0 for consistency.

## Technical detail

In `DailyBriefingHero.tsx` only:

- Add an optional `disabled?: boolean` prop to the local `Chip` component. When true, render a `<span>` with muted styling (`bg-white/5 text-white/50`, no hover/ring) instead of `<Link>`.
- Pass `disabled={counts.overdue === 0}` on the Overdue chip, `disabled={counts.quickTasks === 0}` and `disabled={counts.activeProjects === 0}` on the other two.
- Leave the RAID chip's `buildQueueLink({ section: "raid" })` target, its `> 0` render guard, all data fetching, and `Work.tsx` untouched.
