-- Remaining PM relation lookups used by detail, files, comments, and activity.
create index if not exists idx_pm_tasks_phase
  on public.pm_tasks (phase_id);

create index if not exists idx_pm_tasks_created_by
  on public.pm_tasks (created_by);

create index if not exists idx_pm_projects_template
  on public.pm_projects (template_id);

create index if not exists idx_pm_comments_project_created
  on public.pm_comments (project_id, created_at desc);

create index if not exists idx_pm_attachments_project
  on public.pm_attachments (project_id);

create index if not exists idx_pm_activity_log_task_created
  on public.pm_activity_log (task_id, created_at desc);
