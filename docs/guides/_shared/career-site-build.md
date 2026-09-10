# Career Site project — end-to-end walkthrough

From editing the Career Site template, through create, schedule cascade, pages, and Support mode.

For field-by-field template editing see [Set up a Career Site template](/pm/help?guide=operators/career-site-template). For the create wizard alone see [Start a Career Site project](/pm/help?guide=operators/career-site-project).

## 1 · Finalize the Career Site template

1. Go to [Templates](/pm/templates) → **Career Site** → **Edit**.
2. Confirm **Name** (and optionally **Go-live offset (days)** — stored only; the create wizard suggests go-live from the task schedule, not this offset).
3. Under **Page Groups**, set expected pages, parallel cap, discovery gate `temp_id`, reserved days per phase (blank = formula), and optional page presets. Assign slot tasks to each group in the Tasks list.
4. In **Tasks**, for every row confirm:
   - **Title**, **Type**, **Phase**, **Days**
   - **Page Group** vs **— (one-off)**
   - **Lock** when the bar should stay fixed in the create Gantt
   - **Teams** (Design, Dev, PM, QA, …)
   - **Link snippets** on design/dev tasks that reuse career-site code
5. Dependencies, assignee roles, and lock-to-kickoff / lock-to-go-live may exist on the **seeded** template but are **not** editable in TemplateBuilder — they still copy into new projects.

## 2 · Start a new Career Site project

1. Open the wizard via Templates → **Use**, editor → **Create Project**, or Create Work → Full Project → pick the template.
2. **Step 1 — Dates**: set **Kickoff** (defaults today) and **Go-live**. Use **Use suggested** when the suggested end date fits. Fix **Timeline too tight** warnings before continuing.
3. **Step 2 — Review**: confirm summary and mini Gantt; read the *Pages are defined after Discovery* banner if page groups exist.
4. Click **Confirm & Create**. Title becomes `{template name} — {date}`; **client is not set in the wizard** — add it on the project next.
5. Open **Tasks** and verify phases, reservations, and the BA **Define pages** task.

## 3 · Set / adjust the real schedule

1. On the project header click **Configure Timeline**.
2. Enter or confirm the **Kickoff date**.
3. If the project has no dependencies yet, click **Auto-link tasks in order** — builds a finish-to-start chain from sort order.
4. Click **Recalculate from Kickoff**. Review the confirmation list → **Apply**.
5. If go-live is fixed, set both dates and **Recalculate from Go-Live** — flexible tasks compress to fit.
6. *Schedule already up to date* means nothing needs to move.
7. Use **Diagnose timeline** if a button seems to do nothing — it reports missing dependencies, dates, or kickoff.

## 4 · Edit one task and let the rest cascade

1. Open **Timeline** (Gantt) on the project, or open a task workspace from Tasks.
2. Drag the bar, or change **Start / Due** in the workspace.
3. **Cascade Confirm** lists every downstream task that will shift.
4. **Apply** — dependents update together.
5. **Critical path** tasks (longest chain to go-live) are highlighted on the Gantt.

Tip: cascading only pushes tasks *later*. Pulling a task earlier does not pull dependents unless you recalc from kickoff.

## 5 · Add / remove people

- **Project members:** Overview → **Team** card → **Add** / **×**.
- **Assign a task:** click the **avatar** on a board card or list row.
- **Bulk reassign:** Board list view → select rows → **Reassign** in the bulk bar.

## 6 · All mode vs Me mode

Top-bar toggle. **All** shows every project/task across teams. **Me** narrows to your assignments and projects, filtered by team lane.

## 7 · Page groups & reserved time

Most career sites don’t know the final page list until Discovery. At create, the platform **reserves** time across every phase page slots touch, then **consumes** that reservation when you add real pages.

1. **In the template** (see template guide): page groups + slot tasks + expected pages + parallel cap; reserved days auto-compute unless overridden.
2. **At create**: wizard never asks for pages. Reservation placeholders and a **Define pages** task are created so go-live already includes page capacity.
3. **After Discovery**: project **Pages** tab → **Add pages** → paste names (one per line) → pick group. Each page stamps the bundle and shrinks matching reservation tasks. Over-budget adds can cascade (confirm). Removing a page deletes its tasks; reserved time is **not** auto-refunded.
4. The Pages tab shows defined-vs-expected count and remaining reserved days per group.

## 8 · Enter Support mode

When build/QA is done: project header → **Enter Support mode (Live Career Site)**. The project then appears on [Live Career Sites](/pm/live-sites) for support tickets and ops health.

## Done when

Template slots and reservations are correct, a project exists with kickoff/go-live and client set, pages are defined or still reserved on purpose, owners are clear, and live sites are in Support mode after launch.
