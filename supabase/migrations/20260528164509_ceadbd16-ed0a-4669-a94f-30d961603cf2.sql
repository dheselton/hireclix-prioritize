-- Add requester field to projects
ALTER TABLE public.pm_projects ADD COLUMN IF NOT EXISTS requested_by uuid;

-- Project-level reference links (mirror of pm_task_links)
CREATE TABLE IF NOT EXISTS public.pm_project_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  url text NOT NULL,
  label text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_project_links TO anon, authenticated;
GRANT ALL ON public.pm_project_links TO service_role;

ALTER TABLE public.pm_project_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read" ON public.pm_project_links FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_project_links FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_project_links FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_project_links FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_pm_project_links_project ON public.pm_project_links(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_projects_requested_by ON public.pm_projects(requested_by);