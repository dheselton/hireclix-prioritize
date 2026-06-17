
CREATE TABLE public.pm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text,
  color text,
  default_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  billable_default boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_activities TO authenticated;
GRANT SELECT ON public.pm_activities TO anon;
GRANT ALL ON public.pm_activities TO service_role;
ALTER TABLE public.pm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm_activities readable" ON public.pm_activities FOR SELECT USING (true);
CREATE POLICY "pm_activities insertable" ON public.pm_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "pm_activities updatable" ON public.pm_activities FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "pm_activities deletable" ON public.pm_activities FOR DELETE USING (true);

ALTER TABLE public.pm_time_entries
  ADD COLUMN activity_id uuid REFERENCES public.pm_activities(id) ON DELETE SET NULL,
  ALTER COLUMN task_id DROP NOT NULL,
  ADD CONSTRAINT pm_time_entries_target_chk
    CHECK ((task_id IS NOT NULL)::int + (activity_id IS NOT NULL)::int = 1);

ALTER TABLE public.pm_active_timers
  ADD COLUMN activity_id uuid REFERENCES public.pm_activities(id) ON DELETE SET NULL,
  ALTER COLUMN task_id DROP NOT NULL,
  ADD CONSTRAINT pm_active_timers_target_chk
    CHECK ((task_id IS NOT NULL)::int + (activity_id IS NOT NULL)::int = 1);

INSERT INTO public.pm_activities (name, icon, color, billable_default) VALUES
  ('Meetings', 'Users', '#6366f1', false),
  ('Learning & Development', 'GraduationCap', '#10b981', false),
  ('General / Admin', 'Inbox', '#64748b', false),
  ('Internal Projects', 'Building2', '#f59e0b', false);
