# Career Site project — end-to-end walkthrough

From finalizing the template to editing dates so the whole schedule cascades.

## 1 · Finalize the Career Site template

1. Go to [Templates](/pm/templates) in the sidebar.
2. Find *Career Site* and click **Edit**.
3. For every task, confirm:
   - **Duration (days)** is realistic.
   - **Role** is set (Designer / Developer / PM / etc.) — new projects use this to suggest assignees.
   - **Phase** is set so tasks group correctly in the project.
4. Lock anchor tasks:
   - Mark *Kickoff* as **Locked to kickoff**.
   - Mark *Launch* as **Locked to go-live**.
5. Add **dependencies** so each task lists what it waits on. Without these the timeline cannot cascade.
6. Set **Default go-live offset** (the panel at the top of the template editor) — this is how far out new projects start.

## 2 · Start a new Career Site project

1. Open [All Work](/pm/work) (or use **New Project** from the create-work flow).
2. Pick the **Career Site** template.
3. Pick a **Client** and a **Go-live date**.
4. Click **Create**. The system copies every template task, dependency, and snippet link onto the new project, and seeds dates from the template offsets.
5. Open the project → **Tasks** tab. Verify the phases and tasks landed.

## 3 · Set the real schedule

1. On the project header click **Configure Timeline**.
2. Enter the **Kickoff date**.
3. If the project has no dependencies yet, click **Auto-link tasks in order** — this builds a finish-to-start chain from the current sort order so the cascade has something to follow.
4. Click **Recalculate from Kickoff**. A confirmation modal lists every task that will move. Review and **Apply**.
5. If you already know the go-live, set both dates and click **Recalculate from Go-Live** — flexible tasks compress to fit the window.
6. If you see *"Schedule already up to date"*, the dates are already valid; nothing needs to change.
7. Use **Diagnose timeline** if a button seems to do nothing — it tells you whether you have dependencies, dates, and a kickoff set.

## 4 · Edit one task and let the rest cascade

1. Open **Timeline** (Gantt) on the project, or open a task workspace from the Tasks tab.
2. Drag the bar in the Gantt, or change **Start / Due** in the workspace.
3. The **Cascade Confirm** modal opens, listing every downstream task that will shift and by how many days.
4. Click **Apply** — every dependent task updates at once.
5. Tasks on the **critical path** (longest chain to go-live) are highlighted red on the Gantt.

Tip: cascading only pushes tasks *later*. If you pull a task earlier, downstream tasks stay put unless you recalc from kickoff.

## 5 · Add / remove people

- **Project members:** Project → *Overview* → **Team** card → *Add* to invite a user with a project role; the *×* button removes them.
- **Assign a task:** click the **avatar** on any board card or list row — a search popover lets you assign, change, or unassign inline.
- **Bulk reassign:** on the Board (List view) select multiple rows → use the *Reassign* dropdown in the bulk actions bar.

## 6 · All mode vs Me mode

The toggle in the top bar controls visibility. In **All** mode every user sees every project and task across all teams — designers, devs, strategists, analysts, and PMs. In **Me** mode the view narrows to tasks assigned to you and projects you belong to, filtered by your team lane.

## 7 · Page groups & reserved time (Benefits, Life At, Locations…)

Most career site projects don't know their final page list until Discovery wraps. The platform handles that by **reserving time across every phase your page tasks touch** (Design, Build, QA, etc.) at project creation, then **consuming** that reservation as you add real pages.

1. **In the template editor**: define one or more Page Groups (e.g. "Content Page"). Assign the slot tasks (Wireframe, Design, Build, QA) to that group. Set the group's *Expected pages* (default 5) and *Parallel cap* (default 3 — how many pages your team can work on at once in a single phase).
2. **Per-phase reserved days** auto-compute as *(sum of slot task days in that phase × expected pages ÷ parallel cap)*. Override any phase manually in the template editor if your team works differently.
3. **Creating a project**: the wizard skips the Pages step by default and shows a reservation summary. The schedule includes one *reservation placeholder task per group per phase*, sized to your formula — so Go-Live already accounts for the work.
4. If you already know the pages, tick **"I already know the pages"** in the wizard and pick them — the system stamps them immediately and skips reservations.
5. **After Discovery**: open the project's **Pages** tab, click **Add pages**, paste your page list (one per line), and pick the group. Each page stamps the full bundle and **shrinks the matching reservation tasks** in each phase. If you go over the reservation, normal cascade rules push downstream tasks (Go-Live moves with confirmation).
6. Remove a page anytime from the Pages tab — all its tasks delete together; reserved time is *not* auto-refunded so the schedule stays stable.

Tip: the Pages tab shows defined-vs-expected count and remaining reserved days per group, so you can see at a glance whether your group is still within budget.

## Done when

Template dates and dependencies are solid, a project exists with a real kickoff/go-live, and page reservations (or real pages) match Discovery.
