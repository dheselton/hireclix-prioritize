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
create policy "public update" on public.pm_task_snippets for update using (true);
create index on public.pm_task_snippets(task_id);
create index on public.pm_task_snippets(snippet_id);

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
create policy "public update" on public.pm_template_task_snippets for update using (true);
create index on public.pm_template_task_snippets(template_task_id);