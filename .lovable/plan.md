## Why nothing happened

Today the workflow only has two moments where pages get stamped:

1. **Project creation wizard** — you tick "I already know the pages" and pick them, OR the system stamps reservation placeholders (one per phase per group).
2. **Manual** — you open the project's **Pages** tab and click **Add pages**.

Templates already have a `discovery_task_temp_id` field on each page group (visible in Template Builder), but **nothing at runtime watches for that task to complete**. So moving discovery tasks to Complete does nothing — the reservations just sit there until someone opens the Pages tab.

That's the gap.

## Plan: wire discovery completion to a "Define pages now" prompt

### 1. Persist the discovery link onto live tasks
When `instantiateTemplateIntoProject` runs, if a template task's `temp_id` matches any group's `discovery_task_temp_id`, stamp the resulting live task's `custom_fields.discovery_for_group_ids: string[]` so we can find it later without re-reading the template.

### 2. Detect completion
Add a hook `useDiscoveryCompletion(projectId)` that:
- Loads project tasks + template page groups.
- For each group with a linked discovery task: checks if that live task's status is `complete`/`approved` AND the group still has reservation placeholders (from `fetchProjectReservations`) AND no real pages defined yet for that group.
- Returns the list of groups awaiting page definition.

### 3. Surface the prompt in three places
- **ProjectDetail header banner** (dismissible per session): "Discovery complete for {group name} — define pages now" → opens `AddPageDialog` pre-filtered to that group.
- **PagesTab**: highlight the group card with an amber "Ready to define" badge + inline **Define pages** button that opens AddPageDialog scoped to that group.
- **Daily Briefing** (`/pm`): add a "Pages awaiting definition" callout in the Project Work column, deep-linking to `/pm/projects/:id?tab=pages`.

### 4. AddPageDialog: accept an initial group
Add optional `initialGroupId` prop so clicks from the banner/briefing land on the right group with the picker pre-selected.

### 5. Manual fallback for older projects
For projects where the discovery link wasn't stamped (created before this change), also treat "all tasks in the group's Discovery phase are complete" as the trigger — best-effort, but keeps existing in-flight projects working.

### Out of scope
- No auto-stamping pages from discovery output — user still types/pastes the page list. Auto-generation would need a source of truth we don't have yet.
- No changes to the reservation math or cascade rules.
- No template builder changes beyond what's already there (`discovery_task_temp_id` field already exists).

### Files touched
- `src/lib/pm/api.ts` — stamp `discovery_for_group_ids` during template instantiation
- `src/lib/pm/pageGroups.ts` — new `getGroupsAwaitingPages(projectId, templateId, tasks)` helper
- `src/components/pm/project/AddPageDialog.tsx` — accept `initialGroupId`
- `src/components/pm/project/PagesTab.tsx` — "Ready to define" badge + scoped Define button
- `src/pages/pm/ProjectDetail.tsx` — dismissible banner when any group is awaiting
- `src/lib/pm/briefing.ts` + `src/pages/pm/Briefing.tsx` (or the Project Work column) — awaiting-pages callout
