ALTER TABLE public.pm_active_timers
  ADD CONSTRAINT pm_active_timers_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.pm_tasks(id) ON DELETE CASCADE;