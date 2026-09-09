-- Multi-site career initiatives: umbrella project + per-site rollout requests.
-- parent_project_id on each request still points at the live site (Support queue).
-- This table links those requests to the umbrella initiative.

CREATE TABLE public.pm_site_initiative_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_project_id uuid NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  site_project_id uuid NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  request_project_id uuid NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (initiative_project_id, site_project_id),
  UNIQUE (request_project_id)
);

CREATE INDEX pm_site_initiative_items_initiative_idx
  ON public.pm_site_initiative_items(initiative_project_id);
CREATE INDEX pm_site_initiative_items_site_idx
  ON public.pm_site_initiative_items(site_project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_site_initiative_items TO authenticated;
GRANT ALL ON public.pm_site_initiative_items TO service_role;
-- No broad anon write — matches authenticated app sessions.

ALTER TABLE public.pm_site_initiative_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read initiative items"
  ON public.pm_site_initiative_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated insert initiative items"
  ON public.pm_site_initiative_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated update initiative items"
  ON public.pm_site_initiative_items
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated delete initiative items"
  ON public.pm_site_initiative_items
  FOR DELETE
  TO authenticated
  USING (true);
