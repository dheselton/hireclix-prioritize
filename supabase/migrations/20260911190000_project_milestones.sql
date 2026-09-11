-- Project-level Milestone catalog + column on pm_projects.
-- Separate from pm_project_phases (task/template grouping).

CREATE TABLE IF NOT EXISTS public.pm_milestone_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_milestone_definitions_sort
  ON public.pm_milestone_definitions (sort_order, key);

INSERT INTO public.pm_milestone_definitions (key, label, sort_order) VALUES
  ('concept', 'Concept', 10),
  ('design', 'Design', 20),
  ('build', 'Build', 30),
  ('qa', 'QA', 40),
  ('go_live', 'Go-Live', 50),
  ('support_evolution', 'Support / Evolution', 60)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.pm_projects
  ADD COLUMN IF NOT EXISTS milestone text NULL;

CREATE INDEX IF NOT EXISTS idx_pm_projects_milestone
  ON public.pm_projects (milestone);

ALTER TABLE public.pm_milestone_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read milestones" ON public.pm_milestone_definitions;
CREATE POLICY "Authenticated read milestones"
  ON public.pm_milestone_definitions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Operators manage milestones" ON public.pm_milestone_definitions;
CREATE POLICY "Operators manage milestones"
  ON public.pm_milestone_definitions FOR ALL TO authenticated
  USING (private.has_pm_role(ARRAY['pm','ba']))
  WITH CHECK (private.has_pm_role(ARRAY['pm','ba']));
