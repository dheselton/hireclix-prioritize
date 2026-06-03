CREATE TABLE public.pm_client_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.mock_users(id) ON DELETE CASCADE,
  request_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pm_client_watchers_unique
  ON public.pm_client_watchers (client_id, user_id, COALESCE(request_type, ''));
CREATE INDEX pm_client_watchers_lookup
  ON public.pm_client_watchers (client_id, request_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_client_watchers TO authenticated, anon;
GRANT ALL ON public.pm_client_watchers TO service_role;

ALTER TABLE public.pm_client_watchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read"   ON public.pm_client_watchers FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_client_watchers FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_client_watchers FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_client_watchers FOR DELETE USING (true);