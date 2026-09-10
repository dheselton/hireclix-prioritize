# Set up a Career Site template

**When to use this** — You’re a PM or BA editing the Career Site project template (or creating a new one) so new builds stamp out the right tasks, page reservations, teams, and snippets.

## Steps

### 1 · Open the template

1. Go to [Templates](/pm/templates).
2. Find **Career Site** and click **Edit** (opens `/pm/templates/:id/edit`).
3. Or click **New Template**, enter a **Name** and **Type**, then **Create** — you’re taken straight into the editor.

Templates whose names contain `(don't use)` are hidden from the list.

### 2 · Header fields

At the top of the editor:

| Field | What it does |
|-------|----------------|
| **Name** | Template display name. Saves when you leave the field (blur). |
| **Go-live offset (days)** | Stored on the template (default **30** if empty). The create-project wizard does **not** use this number today — suggested go-live comes from task durations + dependencies. |
| **Create Project** | Opens the same 2-step Dates → Review wizard as Templates → **Use**. See [Start a Career Site project](/pm/help?guide=operators/career-site-project). |

### 3 · Page Groups

Page groups define a **bundle of slot tasks** (e.g. Wireframe → Design → Build → QA) stamped once per page after Discovery.

1. Click **Add group** (empty state: *No page groups yet*).
2. For each group, set:

| Field | What it does |
|-------|----------------|
| **Name** | e.g. Content Page |
| **Expected pages** | Default **5** — how many pages you plan for when reserving time |
| **Parallel cap** | Default **3** — how many pages the team can work in parallel in one phase |
| **Discovery gate (temp_id)** | Optional. Must match a task’s internal `temp_id` (e.g. `t_sitemap_approval`) so reservations wait on Discovery |
| **Reserved time per phase (days)** | One input per phase that has slot tasks. Leave **blank** to use the formula: `ceil(sum of slot task days in that phase × expected pages ÷ parallel cap)`. Override any phase with a number. Helper text: *Blank uses the default formula…* |
| **Page presets** | Optional quick-pick names (Benefits, Life At, Locations…). Type a name → **Add preset** (or Enter). Used later when adding pages on the project. |

The badge **N task slot(s)** counts tasks assigned to this group in the Tasks list.

In-app help on this card: *Define a bundle of tasks… assign tasks to a group to mark them as page slots.*

### 4 · Tasks grid

Click **Add** for a new task (defaults: title *New task*, type `design`, **3** days).

Every row has:

| Column | What it does |
|--------|----------------|
| **Title** | Task name (blur-save) |
| **Type** | One of: `design`, `dev`, `review`, `approval`, `content`, `qa`, `strategy`, `research`, `analytics`, `reporting` |
| **Phase** | Free-text phase name (groups the mini Gantt and reserved-time phases) |
| **Page Group** | **— (one-off)** for project-level tasks, or a page group to make this a **slot** stamped per page |
| **Days** | `duration_days` — drives schedule length |
| **Lock** | Checkbox (`locked`). Locked tasks show a lock icon in the create wizard Gantt |
| **Snippets** | For `design` / `dev` / `development` types only — **Link snippets**. Other types show — |
| **Teams** | Multi-select under the row: Design, Dev, PM, QA, Strategy, Analytics, CSM, Help/Support |
| Delete | Trash icon removes the task |

Empty state: *No tasks yet.*

### 5 · Snippets summary

Below the task list, the **snippets summary** card lists every snippet linked to template tasks.

- Empty: *No snippets linked…* — use a task’s Link snippets control.
- Linked snippets show how many tasks use them.
- At project create, those links copy onto the new project’s tasks.

### 6 · Save and start a project

- Name, offset, tasks, groups, and presets save as you edit (blur / onChange patches). There is no separate Save button.
- When the template is ready, click **Create Project** in the header, or go back to [Templates](/pm/templates) and click **Use**.

## What’s not in the editor (seed / DB only)

The seeded Career Site template may already include data the UI **cannot** edit today. It still copies into new projects:

- **Dependencies** between tasks (`pm_template_dependencies`)
- **Assignee role** / role hints
- **Locked to kickoff** / **locked to go-live** (separate from the Lock checkbox)

If cascade or anchors look wrong after create, ask an engineer to adjust seed/SQL — or use **Configure Timeline** / **Diagnose timeline** on the project. Full post-create scheduling is in the [Career site deep-dive](/pm/help?guide=_shared/career-site-build).

## Done when

- Page groups have expected pages, parallel cap, and slot tasks with phases + days
- One-off tasks (kickoff, discovery, launch, etc.) are present with teams set
- Design/dev slots that need reuse have snippets linked
- You’re ready to run the create wizard from **Create Project** or **Use**

## If this happens

- **Reserved phases don’t appear** — assign slot tasks a **Phase** name and a **Page Group**; reserved inputs only show for phases that have slot tasks.
- **No Link snippets control** — change the task **Type** to `design` or `dev`.
- **Need a fresh template** — New Template from the list, or Create Work → Full Project → **New Template**.
