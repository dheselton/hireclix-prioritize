# Unify date formatting on one canonical helper

Today the app formats dates five different ways, so the same date can appear as `08/03/2026`, `8/3/2026`, or `Aug 3`. This standardizes every display on the canonical `fmtDate` helper (mm/dd/yyyy) and swaps the remaining raw date text boxes for the app's existing date picker.

No change to how dates are stored — the database keeps ISO strings.

## What changes

1. **Support handoff callout** (Daily Briefing): drop its private `formatDate` and use `fmtDate`.
2. **Task comments / activity (CollabHub)**: keep the friendly "5m ago / 2h ago / 3d ago" relative labels for recent items, but anything older than a week falls back to `fmtDate` instead of the browser locale format.
3. **Task card "Starts …" badge** (`taskVisualState.ts`): use `fmtDate` instead of `toLocaleDateString("en-US")`.
4. **Support ready banner**: use `fmtDate` instead of its inline date-fns call.
5. **Date inputs** — replace the native browser date boxes with the existing `DatePicker` component (calendar popover, displays mm/dd/yyyy, emits ISO `YYYY-MM-DD`) in:
   - Edit Project dialog (start, kickoff, go-live)
   - Convert to Project modal (kickoff, go-live)
   - Files tab date-range filter (from / to)

`fmtDate` already outputs mm/dd/yyyy, and `DatePicker` already displays mm/dd/yyyy while storing ISO — verified, no change needed to either.

## Technical notes

- Canonical helpers: `fmtDate` / `fmtDateShort` in `src/lib/pm/format.ts`.
- Picker: `src/components/ui/date-picker.tsx` (`value: string | null` ISO in, `onChange(string | null)` out) — a drop-in for the current `<Input type="date">` state setters; `null` maps to the existing empty-string state.
- Files touched: `src/components/pm/workqueue/SupportHandoffCallout.tsx`, `src/components/pm/workspace/CollabHub.tsx`, `src/lib/pm/taskVisualState.ts`, `src/components/pm/project/SupportReadyBanner.tsx`, `src/components/pm/project/EditProjectDialog.tsx`, `src/components/pm/ConvertToProjectModal.tsx`, `src/components/pm/project/FilesTab.tsx`.
- `taskVisualState.ts` currently holds a `Date`; it will format the raw ISO `task.start_date` through `fmtDate`.

## Out of scope

`ConfigureTimelinePanel.tsx` and `TimelineSetupWizard.tsx` also still use native date inputs. Say the word and they can be converted in the same pass.
