## What the error means

The project was created from a template (e.g. a Career Site template). That template defines **page groups** (like "Build") which are meant to act as reusable bundles of tasks that get stamped onto every page you add. Example: a "Build" page group might contain slots like *Design page → Dev page → QA page → Content review*.

When you click **+ Add 3 pages**, the app looks up every template task tagged with `page_group_id = Build` and clones it for each page name you entered (Home, Search, Job Description). The toast `Page group has no task slots defined yet` means the **Build page group exists, but zero template tasks are attached to it** — so there is nothing to clone, and 0 tasks get inserted. The pages would be added as empty shells, which is why we block it instead.

The fix lives in the **Template editor**, not the project. Someone needs to open the template behind this project, select the Build page group, and attach the task slots (Design / Dev / QA / etc.) that should fan out per page. After that, `+ Add pages` will work and stamp the full bundle.

## Plan

Make this self-explanatory and recoverable from the dialog (no code spelunking needed).

### 1. Detect empty page groups up front
In `AddPageDialog.tsx`, when groups load also fetch `pm_template_tasks` counts grouped by `page_group_id` for the template. Build a `slotCountByGroup: Record<groupId, number>` map.

### 2. Show slot count on each page-group chip
Render the chip as `Build · 0 slots` (muted) vs `Build · 4 slots`. Empty groups are visually dimmed but still selectable so the user can see what's wrong.

### 3. Replace the cryptic toast with an inline explainer + CTA
When the selected group has 0 slots, replace the "Bulk add" textarea area with an inline panel:

> **"Build" has no task slots yet.**
> Page groups stamp a bundle of tasks onto every page you add (e.g. Design → Dev → QA). This group has none defined, so adding pages would create empty shells.
>
> [Open template editor →]  (deep-links to `/pm/templates/{templateId}/edit#group={groupId}`)

The **Add pages** button is disabled in this state with a tooltip pointing at the same fix.

### 4. Keep the existing happy path intact
If the group has slots, behavior is unchanged — bulk-add still stamps the full bundle and consumes reserved time.

### 5. (Optional, ask before doing) Allow "Add as empty pages anyway"
A secondary button that creates one placeholder task per page (just the page label, no bundle) so PMs can scaffold pages before the template is finished. Off by default; only add if you want it.

## Files touched
- `src/components/pm/project/AddPageDialog.tsx` — slot count fetch, chip labels, empty-state panel, deep link, disabled submit.
- No DB / no schema / no scheduler changes.

## How to actually fix *your* current project today
While the above ships, the immediate unblock is: open the template this project was created from, go to the **Build** page group, and add the task slots that should repeat per page. Then come back to **Add Pages** and it will stamp them across Home / Search / Job Description.

Want me to also add the optional "Add as empty pages anyway" escape hatch (step 5)?
