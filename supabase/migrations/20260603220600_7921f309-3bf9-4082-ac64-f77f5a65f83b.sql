
CREATE TABLE public.pm_snippet_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snippet_id uuid NOT NULL REFERENCES public.pm_snippets(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'high',
  reported_by uuid REFERENCES public.mock_users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_snippet_incidents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_snippet_incidents TO anon;
GRANT ALL ON public.pm_snippet_incidents TO service_role;

ALTER TABLE public.pm_snippet_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read"   ON public.pm_snippet_incidents FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_snippet_incidents FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_snippet_incidents FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_snippet_incidents FOR DELETE USING (true);

CREATE INDEX pm_snippet_incidents_snippet_idx ON public.pm_snippet_incidents(snippet_id);
CREATE INDEX pm_snippet_incidents_unresolved_idx ON public.pm_snippet_incidents(snippet_id) WHERE resolved_at IS NULL;

CREATE TRIGGER pm_snippet_incidents_set_updated_at
  BEFORE UPDATE ON public.pm_snippet_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
