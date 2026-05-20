# Handling Variable Per-Project Pages (Benefits, Life At, Locations, Personas…)

## The Problem

A Career Site project always has the same core spine (Discovery → Wireframes → Dev → QA → Launch), but the **content pages** vary wildly per client: one project needs 5 pages, the next needs 20. Today the template is a flat task list — you'd either:
- Hard-code "Benefits page – Design / Dev / QA" once and manually duplicate it 5–20 times per project, or
- Leave pages out of the template entirely and add them ad-hoc, which breaks the timeline.

Neither scales. We need a first-class concept of **repeatable page bundles**.

## The Model: Page Groups

Introduce a new template primitive called a **Page Group**: a small reusable bundle of tasks (e.g. Design → Dev → Content → QA → Approval) that gets instantiated **once per page** the client orders.

```text
Template: Career Site
├── Phase: Discovery          (1x – fixed)
├── Phase: Foundation         (1x – fixed)
├── Page Group: "Content Page" (Nx – per project)
│     ├── Wireframe       (design, 2d)
│     ├── Visual Design   (design, 3d)
│     ├── Build           (dev,    3d)
│     ├── Content Load    (content,1d)
│     └── QA              (qa,     1d)
├── Phase: Integration        (1x – fixed)
└── Phase: Launch             (1x – fixed)
```

When a PM starts a new project from the template, the Timeline Wizard asks: **"Which pages?"** — they pick from a checklist (Home, Benefits, Life At, Locations, Personas, custom…) and set a count. The system stamps out a copy of the Page Group for each one, named e.g. *"Benefits – Wireframe", "Benefits – Visual Design"*, etc., and schedules them into the existing spine.

## How It Slots Into the Existing System

### 1. Schema (small additions, no breaking changes)

- `pm_template_page_groups` — id, template_id, name, phase_name, sort_order
- `pm_template_tasks.page_group_id` — nullable; when set, this task is a "slot" inside the group, not a real task
- `pm_template_page_group_presets` — preset page names per template (Home, Benefits, Life At, Locations, Persona, Job Detail, Search Results, Contact, Privacy, etc.) so PMs aren't typing them every time
- `pm_tasks.page_label` — nullable; on live tasks, stores which page this task belongs to ("Benefits"), so we can group them in views
- `pm_tasks.page_group_key` — short id shared by all tasks for the same page instance, so reordering/deletion can act on the whole page

### 2. Template Builder UI

In `TemplateBuilder.tsx`, add a third card: **Page Groups**.
- Define a group once (name, list of slot tasks with type/duration/dependencies *within the group*).
- Dependencies inside a group are relative ("Visual Design depends on Wireframe"); they get rewritten per page when stamped.
- A group can also depend on a fixed phase ("all pages start after Foundation complete") and feed a fixed phase ("Launch waits for all page QA").

### 3. Timeline Setup Wizard (project creation)

Add a **"Pages"** step after kickoff/go-live:
- Checklist of preset pages + "Add custom page" input
- Count badge per group (e.g. "Persona pages: 3")
- Live preview of total task count and projected end date
- "Apply default set" button (uses template's recommended starter set)

### 4. Scheduler

`instantiateTemplateIntoProject` expands each selected page into real tasks before scheduling. The scheduler already handles N tasks with dependencies — it just sees more of them. Parallelism rule: pages of the same group run in parallel by default (capped by team capacity, optional toggle).

### 5. Adding/Removing Pages Mid-Project

On the project's Tasks tab, add an **"Add page"** button that:
- Shows the same picker as the wizard
- Stamps the group, links it to current dependencies
- Runs cascade recalc so dates shift automatically

Removing a page deletes its `page_group_key` tasks and recalcs forward.

### 6. Views

- **Board / List**: group tasks by `page_label` when filtered to a page-heavy project — collapsible "Benefits (5)" row
- **Gantt**: render each page as a swimlane under its phase
- **Workload**: roll-up by page so a designer sees "5 wireframes due this week"

## What This Replaces / Avoids

- No more cloning the template and editing for every client
- No more "forgot to add QA for the Locations page" — the group enforces completeness
- Estimates stay honest: 12 pages = 12× the page-group duration, scheduled in parallel up to capacity

## Out of Scope (separate follow-ups)

- Auto-suggesting page sets from form submission answers (later, once the request form captures page lists)
- Per-page checklists / acceptance criteria templates (extend `pm_template_tasks.checklist_items` — already supported)
- Client-facing page approval portal

## Files to Touch (implementation phase, not this plan)

- **Migration**: new tables + columns above
- **`src/types/pm.ts`**: `PmTemplatePageGroup`, page_label fields
- **`src/lib/pm/api.ts`**: extend `fetchTemplateBundle`, `buildPreviewFromTemplate`, `instantiateTemplateIntoProject` to expand groups
- **`src/lib/pm/scheduler.ts`**: no algorithm change, but accept expanded task list
- **`src/pages/pm/TemplateBuilder.tsx`**: Page Groups card + preset manager
- **`src/components/pm/TimelineSetupWizard.tsx`**: new "Pages" step
- **`src/components/pm/project/TasksTab.tsx`** + Board/List: group-by-page rendering, "Add page" action
- **`src/pages/pm/Help.tsx`**: walkthrough section for page groups

## Decision Needed Before I Build

1. **Parallelism default**: should all pages of a group run **in parallel** (faster, needs capacity) or **sequential** (predictable, slower)? Recommendation: parallel with a per-template cap (e.g. "max 4 pages designed at once").
2. **Where presets live**: per-template (Career Site has its own list) or global (one master list reused everywhere)? Recommendation: per-template, with a "copy from" shortcut.
3. **Naming**: tasks named *"Benefits – Wireframe"* (page first) or *"Wireframe – Benefits"* (action first)? Recommendation: page first, so grouping in lists reads cleanly.

Once you confirm those three, I'll build it end-to-end.
