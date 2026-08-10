# Move page definition out of project setup and onto the BA

Today the create-project wizard asks which pages the site needs before Discovery has even happened. That question moves out of setup entirely and becomes a real piece of work owned by the BA, after Discovery. Once the BA defines the pages, every page automatically stamps its full task bundle (concept, design, build, QA — wherever pages are referenced).

## What changes

### 1. Project creation no longer asks about pages
- Remove the pages step (Step 2) and the "I already know the pages — let me pick them now" checkbox from the create-project wizard. It becomes a 3-step wizard for every template: Kickoff -> Go-live -> Review.
- Time is still reserved across every phase the page tasks touch, based on each group's expected page count and parallel cap. The review step gets a short line explaining that reserved page time is held and will convert to real tasks once the BA defines pages.

### 2. A single "Define pages" task is created with the project
- One combined task covering all page groups, e.g. **"Define pages (Build, Design)"**.
- Auto-assigned to the project's BA when one is set; otherwise it lands unclaimed and shows the amber needs-assignee treatment.
- Scheduled to start right after the last Discovery task, before the first reserved page phase.
- Its description explains what to deliver, and it opens the page-definition dialog directly from the task with a "Define pages" button.
- The task cannot be marked complete until at least one page has been defined — attempting it explains why and opens the dialog.

### 3. Hard gate on downstream page work
- Every page task bundle created from a page group depends on the "Define pages" task (finish-to-start). Until it's complete, page work is blocked and shows as waiting on that task in the board, timeline, and task workspace.
- Reserved-time placeholders also hang off the same task, so the timeline shows the true blocked chain.

### 4. Defining pages stamps everything
- When the BA adds pages (Pages tab or from the task), each page stamps out its full bundle across every phase that references pages — concept, design, build, QA — consuming the reserved time as it does today.
- The existing "Discovery complete — define pages" banner now points at the "Define pages" task instead of just opening the dialog, so ownership is visible.

## Technical notes

- `src/components/pm/TimelineSetupWizard.tsx` — delete the pages-info/pages-picker step and `pickPagesNow`/`selectedPages` state; always 3 steps. `expandPageGroupsInTemplate` is still called, with an empty page selection, so reservations continue to be stamped.
- `src/lib/pm/api.ts` (`createProjectFromTemplate` / `instantiateTemplateIntoProject`) — after tasks are inserted, create one `pm_tasks` row: type `research`, teams `['pm']`, title `Define pages (<group names>)`, `custom_fields.define_pages: true` plus `page_group_ids`, `assignee_id` = project BA member if present. Add `pm_task_dependencies` rows: define-pages depends on each discovery task; each reserved/page task depends on define-pages.
- `src/lib/pm/pageGroups.ts` (`addPageToProject`) — when the project has a define-pages task, add the dependency for each newly created page task; add a helper `getDefinePagesTask(projectId)` and `definedPageCount(projectId)`.
- Status-change guard for the define-pages task (TaskWorkspace + status pickers) — block `complete` when no pages exist for the project's groups.
- `src/components/pm/project/DiscoveryReadyBanner.tsx` — link to the define-pages task; keep the "Define pages" action.
- `src/components/pm/project/PagesTab.tsx` — show the owner of the define-pages task and its status at the top.
- No schema change required: the new task uses existing `pm_tasks` / `pm_task_dependencies` / `custom_fields`.
