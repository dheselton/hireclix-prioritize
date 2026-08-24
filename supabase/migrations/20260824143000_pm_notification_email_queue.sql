-- Queue internal (coworker) notification emails off pm_notifications.
-- Backfill existing rows so deploying does not mail the historical backlog.

ALTER TABLE public.pm_notifications
  ADD COLUMN IF NOT EXISTS emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_error text;

COMMENT ON COLUMN public.pm_notifications.emailed_at IS
  'When the coworker notification email was claimed/sent (or skipped).';
COMMENT ON COLUMN public.pm_notifications.email_error IS
  'Last error from send-notification-email; null on success or skip.';

UPDATE public.pm_notifications
SET emailed_at = now()
WHERE emailed_at IS NULL;

CREATE INDEX IF NOT EXISTS pm_notifications_email_pending_idx
  ON public.pm_notifications (created_at)
  WHERE emailed_at IS NULL;

-- Atomic claim used by send-notification-email (service role only).
CREATE OR REPLACE FUNCTION public.claim_pm_notification_emails(
  p_notification_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS SETOF public.pm_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  lim integer;
BEGIN
  lim := GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.pm_notifications
    WHERE emailed_at IS NULL
      AND created_at > now() - interval '1 day'
      AND (p_notification_id IS NULL OR id = p_notification_id)
    ORDER BY created_at ASC
    LIMIT lim
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.pm_notifications n
  SET emailed_at = now(),
      email_error = NULL
  FROM picked
  WHERE n.id = picked.id
  RETURNING n.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pm_notification_emails(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pm_notification_emails(uuid, integer) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.pm_notify_email_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  fn_url text;
  auth_key text;
BEGIN
  IF NEW.type NOT IN ('mention', 'assigned', 'unassigned') THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO auth_key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    auth_key := NULL;
  END;

  IF auth_key IS NULL THEN
    auth_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hYXplYnhrb3l1eGJjbWN3eXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDk3NjcsImV4cCI6MjA5MDEyNTc2N30.TcUVLIn7i6CNjVAmvILxYcvT5I8uCB3j9wuPQDb1gwE';
  END IF;

  fn_url := 'https://naazebxkoyuxbcmcwytc.supabase.co/functions/v1/send-notification-email';

  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || auth_key,
      'apikey', auth_key
    ),
    body := jsonb_build_object('notificationId', NEW.id)
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS pm_notifications_email_queue ON public.pm_notifications;
CREATE TRIGGER pm_notifications_email_queue
  AFTER INSERT ON public.pm_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_notify_email_queue();

DO $$
BEGIN
  PERFORM cron.unschedule(j.jobid)
  FROM cron.job j
  WHERE j.jobname = 'drain-pm-notification-emails';
EXCEPTION WHEN undefined_table OR undefined_function THEN
  NULL;
END $$;

SELECT cron.schedule(
  'drain-pm-notification-emails',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://naazebxkoyuxbcmcwytc.supabase.co/functions/v1/send-notification-email',
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
