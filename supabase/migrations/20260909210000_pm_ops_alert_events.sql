-- Inbound careersite-ops alert event log (test + production).

CREATE TABLE public.pm_ops_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL,
  ops_site_id text NOT NULL,
  alert_id text,
  action text,
  project_id uuid REFERENCES public.pm_projects(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'ops'
    CHECK (source IN ('ops', 'test')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ok boolean NOT NULL DEFAULT true,
  message text
);

CREATE INDEX pm_ops_alert_events_received_idx ON public.pm_ops_alert_events(received_at DESC);
CREATE INDEX pm_ops_alert_events_ops_site_idx ON public.pm_ops_alert_events(ops_site_id);
CREATE INDEX pm_ops_alert_events_project_idx ON public.pm_ops_alert_events(project_id);

GRANT SELECT ON public.pm_ops_alert_events TO authenticated;
GRANT SELECT ON public.pm_ops_alert_events TO anon;
GRANT ALL ON public.pm_ops_alert_events TO service_role;

ALTER TABLE public.pm_ops_alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read ops alert events"
  ON public.pm_ops_alert_events
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role bypasses RLS; no insert/update policies for anon/authenticated.
