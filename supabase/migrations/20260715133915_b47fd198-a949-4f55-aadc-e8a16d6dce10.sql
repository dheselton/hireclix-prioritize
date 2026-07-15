
CREATE TABLE IF NOT EXISTS public.pm_task_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.mock_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_task_watchers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_task_watchers TO anon;
GRANT ALL ON public.pm_task_watchers TO service_role;

ALTER TABLE public.pm_task_watchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_task_watchers select all" ON public.pm_task_watchers FOR SELECT USING (true);
CREATE POLICY "pm_task_watchers insert all" ON public.pm_task_watchers FOR INSERT WITH CHECK (true);
CREATE POLICY "pm_task_watchers update all" ON public.pm_task_watchers FOR UPDATE USING (true);
CREATE POLICY "pm_task_watchers delete all" ON public.pm_task_watchers FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS pm_task_watchers_user_idx ON public.pm_task_watchers (user_id);
CREATE INDEX IF NOT EXISTS pm_task_watchers_task_idx ON public.pm_task_watchers (task_id);
