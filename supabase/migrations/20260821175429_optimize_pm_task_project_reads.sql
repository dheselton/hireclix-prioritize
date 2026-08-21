-- Cover the filters and sort orders used by the PM work surfaces.
-- IF NOT EXISTS keeps this safe for environments that added an index manually.
create index if not exists idx_pm_tasks_project_sort
  on public.pm_tasks (project_id, sort_order);

create index if not exists idx_pm_tasks_assignee_due
  on public.pm_tasks (assignee_id, due_date);

create index if not exists idx_pm_tasks_status
  on public.pm_tasks (status);

create index if not exists idx_pm_project_phases_project_sort
  on public.pm_project_phases (project_id, sort_order);

create index if not exists idx_pm_project_members_user_project
  on public.pm_project_members (user_id, project_id);

create index if not exists idx_pm_task_dependencies_depends_on
  on public.pm_task_dependencies (depends_on_task_id);

create index if not exists idx_pm_projects_client_updated
  on public.pm_projects (client_id, updated_at desc);

create index if not exists idx_pm_projects_created_by
  on public.pm_projects (created_by);

create index if not exists idx_pm_projects_updated_at
  on public.pm_projects (updated_at desc);

-- Task workspace sections currently load independently; these indexes keep
-- each scoped read cheap while the UI requests them in parallel.
create index if not exists idx_pm_comments_task_created
  on public.pm_comments (task_id, created_at desc);

create index if not exists idx_pm_attachments_task
  on public.pm_attachments (task_id);

create index if not exists idx_pm_subtasks_task_sort
  on public.pm_subtasks (task_id, sort_order);

create index if not exists idx_pm_checklist_items_task_sort
  on public.pm_checklist_items (task_id, sort_order);

create index if not exists idx_pm_activity_log_project_created
  on public.pm_activity_log (project_id, created_at desc);

create index if not exists idx_pm_notifications_user_created
  on public.pm_notifications (user_id, created_at desc);
