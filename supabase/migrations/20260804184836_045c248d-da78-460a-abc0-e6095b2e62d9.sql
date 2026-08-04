CREATE TABLE public.pm_client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  author_id uuid REFERENCES public.mock_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_client_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_client_notes TO anon;
GRANT ALL ON public.pm_client_notes TO service_role;

ALTER TABLE public.pm_client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_client_notes_select" ON public.pm_client_notes FOR SELECT USING (true);
CREATE POLICY "pm_client_notes_insert" ON public.pm_client_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "pm_client_notes_update" ON public.pm_client_notes FOR UPDATE USING (true);
CREATE POLICY "pm_client_notes_delete" ON public.pm_client_notes FOR DELETE USING (true);

CREATE TRIGGER pm_client_notes_updated_at
  BEFORE UPDATE ON public.pm_client_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX pm_client_notes_client_idx ON public.pm_client_notes (client_id, created_at DESC);

CREATE TABLE public.pm_client_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  path text NOT NULL,
  label text,
  content_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES public.mock_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_client_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_client_assets TO anon;
GRANT ALL ON public.pm_client_assets TO service_role;

ALTER TABLE public.pm_client_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_client_assets_select" ON public.pm_client_assets FOR SELECT USING (true);
CREATE POLICY "pm_client_assets_insert" ON public.pm_client_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "pm_client_assets_update" ON public.pm_client_assets FOR UPDATE USING (true);
CREATE POLICY "pm_client_assets_delete" ON public.pm_client_assets FOR DELETE USING (true);

CREATE INDEX pm_client_assets_client_idx ON public.pm_client_assets (client_id, created_at DESC);

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS archived_at timestamptz;