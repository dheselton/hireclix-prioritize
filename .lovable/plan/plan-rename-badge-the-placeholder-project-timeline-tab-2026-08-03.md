# Plan: Rename / badge the placeholder Project Timeline tab

## Goal
Reduce confusion caused by the non-functional "Timeline" tab inside ProjectDetail.tsx by renaming it and adding a "Coming soon" badge, while leaving the Global Timeline page and all other tabs untouched.

## Approach (Option B)
1. Extend `ProjectTabs` tab item type to optionally carry a badge / secondary label node.
2. In `ProjectDetail.tsx`, change the timeline tab entry to:
   - label: "Project Timeline"
   - badge: "Coming soon" (small muted pill)
3. Keep the existing placeholder content at lines 232-238 exactly as-is.
4. Do not alter tab visibility rules for QA, Pages, Files, Snippets, or Documentation.
5. Do not modify `/pm/timeline` (Global Timeline) or its sidebar label.

## Files to change
- `src/components/pm/project/ProjectTabs.tsx` — add optional `badge?: React.ReactNode` to tab item type, render it next to the label.
- `src/pages/pm/ProjectDetail.tsx` — update the timeline tab entry in the `tabs` array to use the new badge and renamed label.

## Expected result
Project detail tabs will show "Project Timeline" with a small "Coming soon" pill, clearly distinguishing it from the working Global Timeline in the sidebar and setting expectations that the view is not yet built.
