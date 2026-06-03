CREATE TABLE public.pm_task_assignees (
  task_id    uuid NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.mock_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX pm_task_assignees_user_idx ON public.pm_task_assignees(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_task_assignees TO authenticated, anon;
GRANT ALL ON public.pm_task_assignees TO service_role;

ALTER TABLE public.pm_task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_task_assignees_select_all" ON public.pm_task_assignees FOR SELECT USING (true);
CREATE POLICY "pm_task_assignees_insert_all" ON public.pm_task_assignees FOR INSERT WITH CHECK (true);
CREATE POLICY "pm_task_assignees_update_all" ON public.pm_task_assignees FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "pm_task_assignees_delete_all" ON public.pm_task_assignees FOR DELETE USING (true);