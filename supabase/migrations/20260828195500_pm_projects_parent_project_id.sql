-- Link quick-request projects to a live (Support-mode) career site project.
alter table public.pm_projects
  add column if not exists parent_project_id uuid null
    references public.pm_projects(id) on delete set null;

create index if not exists pm_projects_parent_project_id_idx
  on public.pm_projects(parent_project_id);

-- Backfill: careersite_* requests with exactly one Support-mode sibling under the same client.
with support_sites as (
  select
    id,
    client_id
  from public.pm_projects
  where work_type = 'project'
    and status not in ('complete', 'archived')
    and client_id is not null
    and (custom_fields ? 'support_mode_at')
),
unique_support as (
  select client_id, min(id::text)::uuid as site_id
  from support_sites
  group by client_id
  having count(*) = 1
)
update public.pm_projects p
set parent_project_id = u.site_id
from unique_support u
where p.client_id = u.client_id
  and p.work_type = 'request'
  and p.parent_project_id is null
  and coalesce(p.custom_fields->>'request_type', '') like 'careersite_%';
;