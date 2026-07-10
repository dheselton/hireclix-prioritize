# Product Audit Improvements

Ten scoped changes across timer safety, nav polish, destructive-action guards, and small UX fixes. No auth, role switcher, or seeding touched.

## 1. Timer long-running safeguards

**File:** `src/components/pm/timer/ActiveTimerProvider.tsx`, new `src/components/pm/timer/StaleTimerModal.tsx`, new `src/components/pm/timer/LongRunWarning.tsx`, `src/App.tsx`

- Add constants `TIMER_SOFT_WARN_MS = 8 * 3600_000`, `TIMER_REWARN_INTERVAL_MS = 2 * 3600_000`, `TIMER_STALE_MS = 16 * 3600_000`.
- **Soft warning:** In `FloatingTimerTray` (or a new sibling `LongRunWarning` rendered when tray is active), when `elapsedMs >= 8h`, render a persistent banner above the tray with copy `⏱ Timer has been running for Xh Ym. Still working?` and three buttons: Keep Running, Stop & Log, Adjust Time. "Keep Running" stores `nextWarnAt = now + 2h` in local state so it re-appears every 2h. "Stop & Log" calls existing `stop()`. "Adjust Time" opens a popover with hours+minutes inputs pre-filled with elapsed time; on Save, insert a `pm_time_entries` row with the adjusted minutes and clear the active timer (bypass the standard elapsed-based insert).
- **Stale check on load:** In `ActiveTimerProvider`, after the initial DB fetch resolves `current`, compare `startedAt` — if it is before today's midnight OR elapsed > 16h, set `staleTimer` state and render `StaleTimerModal` as a Dialog (blocking, no outside click close). Body copy per spec, pre-fill hours/minutes with elapsed, buttons `Log this time` (insert entry with entered minutes, delete active timer) and `Discard entry` (delete active timer without insert). Do not auto-stop before user picks.
- Modal mounted at App level via provider so it appears before other UI interaction.

## 2. Nav label

**File:** `src/components/AppSidebar.tsx`

- Change label `Work Queue` → `Daily Briefing` for the `/pm` item only. No route or icon changes.

## 3. Remove prototype artifacts

- **Template:** `src/pages/pm/Templates.tsx` — filter out the template whose title matches `Career Site — Full Build (don't use)` from the rendered list (case-insensitive contains `(don't use)`). Leaves the DB row intact.
- **Integrations tab:** `src/pages/pm/Integrations.tsx` — remove the `Client Environments` tab trigger and its `TabsContent` block.
- **Auth badge:** `src/components/TopBar.tsx` — remove the `Auth disabled · dev mode` pill/badge only. Keep the role switcher.

## 4. Deletion confirmations (shadcn AlertDialog)

- **Time entry delete:**
  - `src/components/pm/time/EntryPopover.tsx` — wrap the red trash action in `AlertDialog`. Title `Delete this time entry?`, body `This cannot be undone.`, destructive Delete button.
  - `src/components/pm/time/TimeEntriesList.tsx` — same pattern on the flat-list row delete.
- **Task delete:** `src/pages/pm/TaskWorkspace.tsx` — wrap the header Delete button. Title `Permanently delete this task?`, body `All data, files, and comments will be lost. This cannot be undone.`, buttons Cancel and `Delete task` (destructive).

## 5. Workload capacity label

**File:** `src/pages/pm/Workload.tsx`, `src/components/pm/UserAvatar.tsx` or wherever role text is rendered on the workload card.

- Change fraction render from `{thisWeek.length} / {Math.round(cap)}` to `{n} / {cap} tasks this week` and wrap in a shadcn `Tooltip` with content `Current active tasks vs. recommended weekly capacity`.
- Role label casing: add a `formatRoleLabel(role)` helper (or inline) that maps `csm` → `CSM`, otherwise title-case. Apply in the workload card's `u.role` render. (Search for other spots that display role verbatim and apply if trivially in the same file; other pages out of scope.)

## 6. Timesheet summary warnings

**File:** `src/pages/pm/Timesheet.tsx` (summary cards) plus helper in `src/lib/pm/time.ts` if needed.

- Compute per-day and per-week totals already present. If any single-day total > 24h or the week total > 80h, render the affected summary value in `text-amber-600` with an inline `AlertTriangle` icon and shadcn Tooltip: `This total seems high — check for a running timer or duplicate entries`.
- Visual only. No data changes.

## 7. Work list sort controls

**File:** `src/components/pm/collections/TaskListView.tsx` (list mode used by `/pm/work`).

- Add local state `sort: { key: 'title'|'status'|'due'|'priority'|null, dir: 'asc'|'desc' }` initial `{key:null}` (preserves existing order).
- Wrap the Title/Status/Due/Priority header cells in buttons; click cycles asc → desc → asc on that column, switching to asc when a new column is picked.
- Render `ChevronUp`/`ChevronDown` next to the active column header.
- When `sort.key` is set, sort a copy of tasks by that field: title (localeCompare), status (STATUS_GROUPS order index), due (date compare, nulls last), priority (priority rank).

## 8. Form descriptions

**Schema:** add nullable `description text` column to `pm_forms` via migration.

**Files:**
- Migration adding the column (no GRANT/RLS changes needed; existing table policies apply).
- `src/pages/pm/Forms.tsx` — render `form.description` under the form name on each card; if empty, fall back to the mapping:
  - name contains `Web / Email` → `Use for web page builds, email campaigns, and landing pages`
  - name contains `General` → `Use for print, social, brand, and all other creative requests`
  - name equals `Creative Request` → `General intake for all creative work requests`
- `src/pages/pm/FormBuilder.tsx` — add a Description textarea in the form-metadata section that saves to the new column.
- Regenerate types (`src/integrations/supabase/types.ts`) as part of migration.

## 9. Submitter view polish

**Files:** `src/components/pm/workqueue/TaskListByType.tsx` (or the submitter branch of `src/pages/pm/WorkQueue.tsx`), `src/components/AppSidebar.tsx`.

- In the submitter `TaskListByType` render (or a submitter-only column), add a Status column using existing `StatusPill` next to each row.
- In `AppSidebar`, when `role === 'submitter'` (or any of the user's roles resolves to submitter-only), hide the numeric badge on the `/pm` nav item.

## 10. Daily Briefing button disambiguation

**File:** `src/components/pm/workqueue/ProjectBriefingCard.tsx`.

- Inspect the two CTA buttons. If both link to the same URL, remove the duplicate. If they point to different destinations (task list vs project overview), rename to `View tasks` (task-scoped link) and `Open project` (project overview link).

## Technical notes

- Threshold constants exported from `src/components/pm/timer/ActiveTimerProvider.tsx` so future tuning is one edit.
- Stale-timer modal uses existing shadcn `Dialog` with `onOpenChange` locked open until action taken.
- All new confirmations use shadcn `AlertDialog` for consistency.
- Form description migration: `ALTER TABLE public.pm_forms ADD COLUMN description text;` — pm_forms already has grants/policies, no changes needed.
- No changes to: auth flow, role switcher, `VITE_PM_AUTH_ENABLED`, mock user seeding, scheduler, or RLS policies.
