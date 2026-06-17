CREATE TABLE public.pm_user_pinned_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.mock_users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_id)
);

CREATE INDEX pm_user_pinned_tasks_user_idx ON public.pm_user_pinned_tasks(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_user_pinned_tasks TO anon, authenticated;
GRANT ALL ON public.pm_user_pinned_tasks TO service_role;

ALTER TABLE public.pm_user_pinned_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_user_pinned_tasks all read" ON public.pm_user_pinned_tasks FOR SELECT USING (true);
CREATE POLICY "pm_user_pinned_tasks all insert" ON public.pm_user_pinned_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "pm_user_pinned_tasks all update" ON public.pm_user_pinned_tasks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "pm_user_pinned_tasks all delete" ON public.pm_user_pinned_tasks FOR DELETE USING (true);