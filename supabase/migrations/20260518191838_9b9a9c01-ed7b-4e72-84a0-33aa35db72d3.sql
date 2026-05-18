
ALTER TABLE public.pm_projects
  ADD COLUMN IF NOT EXISTS kickoff_date date,
  ADD COLUMN IF NOT EXISTS client_contact_name text,
  ADD COLUMN IF NOT EXISTS client_contact_email text;

CREATE TABLE IF NOT EXISTS public.pm_project_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'file',
  url text NOT NULL,
  name text NOT NULL,
  label text,
  file_size bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_project_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read" ON public.pm_project_attachments FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_project_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_project_attachments FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_project_attachments FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS pm_project_attachments_project_idx ON public.pm_project_attachments(project_id);
