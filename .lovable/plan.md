## Goal

Build snippet ↔ task linking in two layers:
1. **Prompt C** — link snippets to live tasks (Task Workspace), with a reusable search popover.
2. **This prompt** — link snippets to template tasks, propagate to live tasks on project creation, and surface a template-level snippet summary.

---

## Part 1 — Prompt C (live task ↔ snippet linking)

### Database (single migration)

```sql
create table public.pm_task_snippets (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.pm_tasks(id) on delete cascade,
  snippet_id uuid not null references public.pm_snippets(id) on delete cascade,
  linked_by uuid references public.mock_users(id),
  linked_at timestamptz not null default now(),
  unique(task_id, snippet_id)
);
alter table public.pm_task_snippets enable row level security;
create policy "public read"   on public.pm_task_snippets for select using (true);
create policy "public insert" on public.pm_task_snippets for insert with check (true);
create policy "public delete" on public.pm_task_snippets for delete using (true);
create index on public.pm_task_snippets(task_id);
create index on public.pm_task_snippets(snippet_id);
```

### Reusable popover

New `src/components/pm/snippets/SnippetSearchPopover.tsx`:
- Controlled `open`, `onOpenChange`, `linkedSnippetIds`, `onToggle(snippetId)`.
- Trigger slot via `children` (so it can wrap a badge, button, etc.).
- Body: search input (title / tag / category match), category filter chips, scrollable result list (title, category badge, language). Selected rows show a check; clicking toggles link via `onToggle`.
- Loads all snippets + categories once on first open, caches in component state.

### Task Workspace integration

- New section `src/components/pm/workspace/SnippetsSection.tsx` rendered in `TaskWorkspace.tsx` under `LinksSection`.
- Header: "Snippets" + "+ Link snippet" button that opens `SnippetSearchPopover`.
- Body: card list of linked snippets (title, category badge, language, copy button → uses first variation, unlink ✕). Empty state: "No snippets linked yet."
- Data lives in `src/lib/pm/taskSnippets.ts` (list/link/unlink helpers).

---

## Part 2 — Template ↔ snippet linking & propagation

### Database (same migration)

```sql
create table public.pm_template_task_snippets (
  id uuid primary key default gen_random_uuid(),
  template_task_id uuid not null references public.pm_template_tasks(id) on delete cascade,
  snippet_id uuid not null references public.pm_snippets(id) on delete cascade,
  unique(template_task_id, snippet_id)
);
alter table public.pm_template_task_snippets enable row level security;
create policy "public read"   on public.pm_template_task_snippets for select using (true);
create policy "public insert" on public.pm_template_task_snippets for insert with check (true);
create policy "public delete" on public.pm_template_task_snippets for delete using (true);
create index on public.pm_template_task_snippets(template_task_id);
```

### Template editor UI (`src/pages/pm/TemplateBuilder.tsx`)

- Add a **Snippets** cell to each task row (shrink Title to col-span-3, add col-span-1 Snippets between Type and Phase, or place after delete — final grid retuned to 13 cols or by trimming existing column widths).
- Cell renders only when `task.type` ∈ {`design`, `development`, `dev`} (Dev/Design only — hide for PM/QA/strategy/analytics/research/review/approval/reporting).
- Component `TemplateTaskSnippetCell`:
  - Loads snippet count for that `template_task_id`.
  - Renders pill: `<Code2/> 2 snippets` when count > 0, `<Code2/> Link snippets` when 0.
  - Clicking opens `SnippetSearchPopover` with `linkedSnippetIds` for this template task; `onToggle` inserts/deletes in `pm_template_task_snippets`, then refreshes count.

### Template summary panel

Below the tasks Card in `TemplateBuilder.tsx`, new Card "Snippets in this template":
- Query: `pm_template_task_snippets` joined to `pm_snippets` + `pm_snippet_categories` for this template (via template_task_id IN tasks).
- Aggregate by snippet_id → row: title, category badge, `Used in N tasks`.
- Empty state: "No snippets linked to any task yet."

### Propagation in `createProjectFromTemplate`

Inside `instantiateTemplateIntoProject` (`src/lib/pm/api.ts`), after dependency insert:
```ts
// Fetch all template→snippet links for these template tasks
const tempTaskIds = previewTasks.map(p => /* original template_task.id, NOT temp_id */);
```
Issue: `previewTasks` currently carries `temp_id` (string) but not the original `pm_template_tasks.id`. Fix by either:
- Extending `PreviewTask` with `template_task_id?: string` and populating it in `buildPreviewFromTemplate` (preferred — single line change), **or**
- Refetching `pm_template_tasks` by `temp_id` set inside the instantiator.

Plan uses option 1. Then:
```ts
const { data: links } = await supabase
  .from('pm_template_task_snippets')
  .select('template_task_id, snippet_id')
  .in('template_task_id', tempTaskIds);

const realIdByTempTaskId = new Map<string,string>();
for (const pt of previewTasks) {
  const realId = idByTemp.get(pt.temp_id);
  if (pt.template_task_id && realId) realIdByTempTaskId.set(pt.template_task_id, realId);
}
const snippetRows = (links ?? [])
  .map(l => ({ task_id: realIdByTempTaskId.get(l.template_task_id), snippet_id: l.snippet_id, linked_by: getCurrentUserId() ?? null }))
  .filter(r => r.task_id);
if (snippetRows.length) await supabase.from('pm_task_snippets').insert(snippetRows as any);
```

---

## Constraints honored

- Template and live snippet links are independent tables — editing one does not affect the other.
- Both join tables `ON DELETE CASCADE` from `pm_snippets`, so library deletes clean up automatically.
- Snippet column hidden for non Dev/Design template tasks.
- Single reusable `SnippetSearchPopover` used by Task Workspace and Template editor.
- No new routes.

---

## File-level changes

**New**
- `supabase/migrations/<ts>_task_and_template_snippet_links.sql`
- `src/components/pm/snippets/SnippetSearchPopover.tsx`
- `src/components/pm/workspace/SnippetsSection.tsx`
- `src/lib/pm/taskSnippets.ts`
- `src/components/pm/snippets/TemplateTaskSnippetCell.tsx`
- `src/components/pm/snippets/TemplateSnippetSummary.tsx`

**Edited**
- `src/pages/pm/TaskWorkspace.tsx` — mount `SnippetsSection`.
- `src/pages/pm/TemplateBuilder.tsx` — snippet cell per row (Dev/Design only) + summary card.
- `src/lib/pm/api.ts` — extend `PreviewTask` with `template_task_id`, populate it in `buildPreviewFromTemplate`, add snippet propagation in `instantiateTemplateIntoProject`.
- `mem://index.md` — add a note about the two snippet-link tables.
