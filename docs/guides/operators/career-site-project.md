# Start a Career Site project

**When to use this** — You’re creating a greenfield Career Site build from the Career Site template.

Template setup (every editor field) is covered in [Set up a Career Site template](/pm/help?guide=operators/career-site-template). Cascade, Pages tab detail, and Me/All mode are in the [Career site deep-dive](/pm/help?guide=_shared/career-site-build).

## Steps

### 1 · Open the create wizard (any entry point)

Pick one:

1. [Templates](/pm/templates) → Career Site → **Use**
2. Template editor → **Create Project**
3. **Create Work** → **Full Project** → pick the Career Site template (Create Work closes; the wizard opens)

All three open the same dialog: **Create project from Career Site — Dates / Review (step N of 2)**.

### 2 · Step 1 of 2 — Dates

1. Set **Kickoff date** (defaults to today). Help text: *All tasks schedule forward from here.*
2. Set **Go-live date**. The app suggests a go-live from kickoff + task schedule (durations and seeded dependencies). It does **not** use the template’s “Go-live offset (days)” field.
3. Review the **Suggested go-live** panel. Click **Use suggested** to match it.
4. If the window is too short, you’ll see **Timeline too tight** — named tasks would compress below minimum duration, plus a **Suggested earliest go-live**.
5. Click **Next** (disabled until both dates are set).

There is **no Client picker** and **no page list** in this wizard. Pages are always defined later.

### 3 · Step 2 of 2 — Review

1. Optionally adjust Kickoff / Go-live again.
2. Check the summary: weeks, total days, task count.
3. If the template has page groups, read the info banner: *Pages are defined after Discovery.* Time is reserved now; a **Define pages** task will be created for the BA.
4. Skim the mini Gantt by phase (lock icons = locked template tasks).
5. Click **Confirm & Create**.

Toast: *Project created* → you land on `/pm/projects/{id}`.

### 4 · What gets created

- **Title**: `{Template name} — {today’s locale date}` (edit the title on the project if you want a client-specific name).
- **Client**: `null` at create — set the client on the project afterward (Overview / client card).
- All template **tasks**, **dependencies** (from seed), and **snippet links** are copied.
- Page groups become **reservation placeholder tasks** per group per phase (so go-live already accounts for page work).
- A BA **Define pages (…)** task is created; reserved page phases wait on it after Discovery.

### 5 · Right after create

1. Set the **Client** on the project.
2. Open **Configure Timeline** on the project header if dates need a recalc (kickoff, auto-link, recalculate from kickoff or go-live). Use **Diagnose timeline** if a button seems to do nothing.
3. On **Overview → Team**, add designers/devs/PM/BA and assign tasks (avatar on cards, or bulk reassign on the board).
4. Work the build through phases; use Timeline (Gantt) or task workspace for date changes (cascade confirm).

### 6 · After Discovery — define pages

1. Complete Discovery / the gate your template expects.
2. Open the project **Pages** tab → **Add pages**.
3. Paste page names (one per line), pick the page group (presets help).
4. Each page stamps the slot bundle and **consumes** reserved time. Going over reservation can cascade (confirm). Removing a page deletes its tasks; reserved time is **not** auto-refunded.

### 7 · Go live → Support mode

1. Finish QA / launch work.
2. On the project header menu: **Enter Support mode (Live Career Site)**.
3. The project appears on [Live Career Sites](/pm/live-sites) for ongoing support tickets.

## Done when

Project exists with kickoff + go-live, client set, team staffed, pages defined (or still reserved on purpose), and — after launch — Support mode is on.

## If this happens

- **Wizard won’t advance** — both Kickoff and Go-live must be filled.
- **Timeline too tight** — move go-live later or click Use suggested / use the earliest go-live from the warning.
- **No Client on the new project** — expected; set it on the project after create.
- **Cascade does nothing** — need dependencies + kickoff; see [Career site deep-dive](/pm/help?guide=_shared/career-site-build).
- **Template looks wrong** — fix it first: [Set up a Career Site template](/pm/help?guide=operators/career-site-template).
