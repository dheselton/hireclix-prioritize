
CREATE TABLE public.pm_notification_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.mock_users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_notification_prefs TO authenticated, anon;
GRANT ALL ON public.pm_notification_prefs TO service_role;
ALTER TABLE public.pm_notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.pm_notification_prefs FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_notification_prefs FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_notification_prefs FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_notification_prefs FOR DELETE USING (true);
