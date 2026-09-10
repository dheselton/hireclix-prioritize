-- Vendor escalation enrichment: summary, taxonomy, contact, SLA clocks, touchpoint URL.

ALTER TABLE public.pm_vendor_escalations
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IS NULL OR category IN (
      'bug', 'outage', 'performance', 'feature_gap', 'billing', 'other'
    )),
  ADD COLUMN IF NOT EXISTS impact_summary text,
  ADD COLUMN IF NOT EXISTS vendor_contact_name text,
  ADD COLUMN IF NOT EXISTS vendor_contact_email text,
  ADD COLUMN IF NOT EXISTS root_cause text,
  ADD COLUMN IF NOT EXISTS expected_response_by timestamptz,
  ADD COLUMN IF NOT EXISTS expected_resolve_by timestamptz,
  ADD COLUMN IF NOT EXISTS response_breached_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolve_breached_at timestamptz;

ALTER TABLE public.pm_vendor_touchpoints
  ADD COLUMN IF NOT EXISTS thread_url text;

-- Backfill short summary from description or title.
UPDATE public.pm_vendor_escalations
   SET summary = left(coalesce(nullif(trim(description), ''), title), 200)
 WHERE summary IS NULL;

-- Stamp response breach when first inbound arrives after expected_response_by.
CREATE OR REPLACE FUNCTION public.pm_vendor_touchpoint_clock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cadence integer;
  follow_date date;
  was_first boolean;
  exp_resp timestamptz;
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
    SELECT first_response_at IS NULL, expected_response_by
      INTO was_first, exp_resp
      FROM public.pm_vendor_escalations
     WHERE id = NEW.escalation_id;

    UPDATE public.pm_vendor_escalations
       SET last_inbound_at = NEW.occurred_at,
           first_response_at = COALESCE(first_response_at, NEW.occurred_at),
           next_follow_up_on = NULL,
           status = CASE
             WHEN status IN ('resolved', 'closed_unresolved') THEN status
             ELSE 'awaiting_us'
           END,
           response_breached_at = CASE
             WHEN was_first
               AND exp_resp IS NOT NULL
               AND NEW.occurred_at > exp_resp
               AND response_breached_at IS NULL
             THEN NEW.occurred_at
             ELSE response_breached_at
           END,
           updated_at = now()
     WHERE id = NEW.escalation_id;
  END IF;

  RETURN NEW;
END;
$$;
