
CREATE TABLE public.pm_task_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  url text NOT NULL,
  label text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pm_task_links_task ON public.pm_task_links(task_id);
ALTER TABLE public.pm_task_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.pm_task_links FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_task_links FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_task_links FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_task_links FOR DELETE USING (true);

CREATE TABLE public.pm_active_timers (
  user_id uuid PRIMARY KEY,
  task_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  note text
);
ALTER TABLE public.pm_active_timers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.pm_active_timers FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_active_timers FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_active_timers FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_active_timers FOR DELETE USING (true);
