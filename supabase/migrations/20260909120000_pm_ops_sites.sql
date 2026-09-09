-- Cache of careersite-ops live sites + link to Prioritize projects.

CREATE TABLE public.pm_ops_sites (
  ops_site_id text PRIMARY KEY,
  name text NOT NULL,
  client_name text,
  prod_url text,
  platform text,
  health_status text NOT NULL DEFAULT 'unknown'
    CHECK (health_status IN ('up', 'down', 'degraded', 'unknown')),
  last_checked_at timestamptz,
  project_id uuid REFERENCES public.pm_projects(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_ops_sites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_ops_sites TO anon;
GRANT ALL ON public.pm_ops_sites TO service_role;

ALTER TABLE public.pm_ops_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read"   ON public.pm_ops_sites FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_ops_sites FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_ops_sites FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_ops_sites FOR DELETE USING (true);

CREATE INDEX pm_ops_sites_project_idx ON public.pm_ops_sites(project_id);
CREATE INDEX pm_ops_sites_client_idx ON public.pm_ops_sites(client_id);
CREATE INDEX pm_ops_sites_prod_url_idx ON public.pm_ops_sites(prod_url);
CREATE INDEX pm_ops_sites_unmapped_idx ON public.pm_ops_sites(ops_site_id) WHERE project_id IS NULL;
CREATE INDEX pm_ops_sites_health_idx ON public.pm_ops_sites(health_status);

CREATE TRIGGER pm_ops_sites_set_updated_at
  BEFORE UPDATE ON public.pm_ops_sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Hourly sync cron (edge function). Secrets must be set in vault / function env.
-- Job is no-op until OPS_SITES_API_URL is configured.

DO $$
BEGIN
  PERFORM cron.unschedule(j.jobid)
  FROM cron.job j
  WHERE j.jobname = 'sync-ops-sites-hourly';
EXCEPTION WHEN undefined_table OR undefined_function THEN
  NULL;
END $$;

SELECT cron.schedule(
  'sync-ops-sites-hourly',
  '15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://naazebxkoyuxbcmcwytc.supabase.co/functions/v1/sync-ops-sites',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1),
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hYXplYnhrb3l1eGJjbWN3eXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDk3NjcsImV4cCI6MjA5MDEyNTc2N30.TcUVLIn7i6CNjVAmvILxYcvT5I8uCB3j9wuPQDb1gwE'
      ),
      'apikey', COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1),
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hYXplYnhrb3l1eGJjbWN3eXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDk3NjcsImV4cCI6MjA5MDEyNTc2N30.TcUVLIn7i6CNjVAmvILxYcvT5I8uCB3j9wuPQDb1gwE'
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);
