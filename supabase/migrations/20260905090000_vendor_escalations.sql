-- Vendor escalation tracking: registry, escalations, touchpoints, task links,
-- follow-up clock trigger, and daily nudge cron.

-- ── Vendors ──────────────────────────────────────────────────────────────────

CREATE TABLE public.pm_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('platform', 'ipaas', 'ats', 'hosting', 'other')),
  support_url text,
  support_email text,
  contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  follow_up_cadence_days integer NOT NULL DEFAULT 3,
  expected_first_response_days integer,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_vendors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_vendors TO anon;
GRANT ALL ON public.pm_vendors TO service_role;

ALTER TABLE public.pm_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read"   ON public.pm_vendors FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_vendors FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_vendors FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_vendors FOR DELETE USING (true);

CREATE INDEX pm_vendors_active_idx ON public.pm_vendors(active) WHERE active = true;

-- ── Escalations ───────────────────────────────────────────────────────────────

CREATE TABLE public.pm_vendor_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.pm_vendors(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  vendor_ref text,
  status text NOT NULL DEFAULT 'awaiting_vendor'
    CHECK (status IN ('awaiting_vendor', 'awaiting_us', 'resolved', 'closed_unresolved')),
  severity text NOT NULL DEFAULT 'high'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  owner_id uuid REFERENCES public.pm_users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  last_outbound_at timestamptz,
  first_response_at timestamptz,
  last_inbound_at timestamptz,
  next_follow_up_on date,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_vendor_escalations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_vendor_escalations TO anon;
GRANT ALL ON public.pm_vendor_escalations TO service_role;

ALTER TABLE public.pm_vendor_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read"   ON public.pm_vendor_escalations FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_vendor_escalations FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_vendor_escalations FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_vendor_escalations FOR DELETE USING (true);

CREATE INDEX pm_vendor_escalations_vendor_idx ON public.pm_vendor_escalations(vendor_id);
CREATE INDEX pm_vendor_escalations_status_idx ON public.pm_vendor_escalations(status);
CREATE INDEX pm_vendor_escalations_follow_up_idx
  ON public.pm_vendor_escalations(next_follow_up_on)
  WHERE next_follow_up_on IS NOT NULL AND status = 'awaiting_vendor';
CREATE INDEX pm_vendor_escalations_owner_idx ON public.pm_vendor_escalations(owner_id);

CREATE TRIGGER pm_vendor_escalations_set_updated_at
  BEFORE UPDATE ON public.pm_vendor_escalations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Touchpoints ───────────────────────────────────────────────────────────────

CREATE TABLE public.pm_vendor_touchpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id uuid NOT NULL REFERENCES public.pm_vendor_escalations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  channel text NOT NULL DEFAULT 'email'
    CHECK (channel IN ('email', 'call', 'chat', 'portal', 'meeting')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  summary text NOT NULL,
  logged_by uuid REFERENCES public.pm_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_vendor_touchpoints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_vendor_touchpoints TO anon;
GRANT ALL ON public.pm_vendor_touchpoints TO service_role;

ALTER TABLE public.pm_vendor_touchpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read"   ON public.pm_vendor_touchpoints FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_vendor_touchpoints FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_vendor_touchpoints FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_vendor_touchpoints FOR DELETE USING (true);

CREATE INDEX pm_vendor_touchpoints_escalation_idx
  ON public.pm_vendor_touchpoints(escalation_id, occurred_at DESC);

-- Touchpoint clock: keep escalation follow-up fields in sync.
CREATE OR REPLACE FUNCTION public.pm_vendor_touchpoint_clock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cadence integer;
  follow_date date;
BEGIN
  IF NEW.direction = 'outbound' THEN
    SELECT COALESCE(v.follow_up_cadence_days, 3)
      INTO cadence
      FROM public.pm_vendor_escalations e
      JOIN public.pm_vendors v ON v.id = e.vendor_id
     WHERE e.id = NEW.escalation_id;

    follow_date := (NEW.occurred_at AT TIME ZONE 'UTC')::date + cadence;

    UPDATE public.pm_vendor_escalations
       SET last_outbound_at = NEW.occurred_at,
           next_follow_up_on = follow_date,
           status = CASE
             WHEN status IN ('resolved', 'closed_unresolved') THEN status
             ELSE 'awaiting_vendor'
           END,
           updated_at = now()
     WHERE id = NEW.escalation_id;

  ELSIF NEW.direction = 'inbound' THEN
    UPDATE public.pm_vendor_escalations
       SET last_inbound_at = NEW.occurred_at,
           first_response_at = COALESCE(first_response_at, NEW.occurred_at),
           next_follow_up_on = NULL,
           status = CASE
             WHEN status IN ('resolved', 'closed_unresolved') THEN status
             ELSE 'awaiting_us'
           END,
           updated_at = now()
     WHERE id = NEW.escalation_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER pm_vendor_touchpoints_clock
  AFTER INSERT ON public.pm_vendor_touchpoints
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_vendor_touchpoint_clock();

-- ── Escalation ↔ task links ───────────────────────────────────────────────────

CREATE TABLE public.pm_vendor_escalation_tasks (
  escalation_id uuid NOT NULL REFERENCES public.pm_vendor_escalations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (escalation_id, task_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_vendor_escalation_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_vendor_escalation_tasks TO anon;
GRANT ALL ON public.pm_vendor_escalation_tasks TO service_role;

ALTER TABLE public.pm_vendor_escalation_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read"   ON public.pm_vendor_escalation_tasks FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_vendor_escalation_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_vendor_escalation_tasks FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_vendor_escalation_tasks FOR DELETE USING (true);

CREATE INDEX pm_vendor_escalation_tasks_task_idx
  ON public.pm_vendor_escalation_tasks(task_id);

-- ── Daily follow-up nudge cron ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fanout_vendor_follow_up_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inserted integer := 0;
BEGIN
  WITH due AS (
    SELECT e.id AS escalation_id,
           e.title,
           e.owner_id,
           e.next_follow_up_on,
           v.name AS vendor_name
      FROM public.pm_vendor_escalations e
      JOIN public.pm_vendors v ON v.id = e.vendor_id
     WHERE e.status = 'awaiting_vendor'
       AND e.next_follow_up_on IS NOT NULL
       AND e.next_follow_up_on <= CURRENT_DATE
       AND e.owner_id IS NOT NULL
  ),
  fresh AS (
    SELECT d.*
      FROM due d
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.pm_notifications n
        WHERE n.user_id = d.owner_id
          AND n.type = 'vendor_follow_up_due'
          AND n.link = '/pm/vendors?escalation=' || d.escalation_id::text
          AND n.created_at > now() - interval '20 hours'
     )
  ),
  inserted_rows AS (
    INSERT INTO public.pm_notifications (user_id, type, title, body, link)
    SELECT f.owner_id,
           'vendor_follow_up_due',
           'Follow up with ' || f.vendor_name,
           'Escalation “' || f.title || '” is due for follow-up (was due ' || f.next_follow_up_on::text || ').',
           '/pm/vendors?escalation=' || f.escalation_id::text
      FROM fresh f
    RETURNING 1
  )
  SELECT COUNT(*)::integer INTO inserted FROM inserted_rows;

  RETURN COALESCE(inserted, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.fanout_vendor_follow_up_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fanout_vendor_follow_up_notifications() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule(j.jobid)
  FROM cron.job j
  WHERE j.jobname = 'fanout-vendor-follow-ups';
EXCEPTION WHEN undefined_table OR undefined_function THEN
  NULL;
END $$;

SELECT cron.schedule(
  'fanout-vendor-follow-ups',
  '0 13 * * *',
  $cron$ SELECT public.fanout_vendor_follow_up_notifications(); $cron$
);
