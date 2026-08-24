-- Track confirmation-email outcomes on intake submissions (visibility for silent failures).
ALTER TABLE public.pm_form_submissions
  ADD COLUMN IF NOT EXISTS received_emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_email_error text;

COMMENT ON COLUMN public.pm_form_submissions.received_emailed_at IS
  'When the request-received confirmation email was successfully sent.';
COMMENT ON COLUMN public.pm_form_submissions.received_email_error IS
  'Last error from send-request-email (received); null on success.';

-- Repair completion-email trigger: wrong project ref (ybdtzajgkpxsiennooax) and
-- stale anon-key fallback. Point at live project naazebxkoyuxbcmcwytc and add replyTo.
CREATE OR REPLACE FUNCTION public.pm_notify_request_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  sub RECORD;
  fn_url text;
  auth_key text;
  req_type text;
  reply_to text;
BEGIN
  IF NEW.status NOT IN ('complete','approved') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('complete','approved') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO sub
  FROM public.pm_form_submissions s
  WHERE (s.created_task_id = NEW.id OR s.created_project_id = NEW.project_id)
    AND s.submitter_email IS NOT NULL
    AND s.completion_emailed_at IS NULL
  ORDER BY (s.created_task_id = NEW.id) DESC, s.created_at DESC
  LIMIT 1;

  IF sub IS NULL THEN
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

  -- Fallback: live project anon key (public publishable). Prefer vault service_role.
  IF auth_key IS NULL THEN
    auth_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hYXplYnhrb3l1eGJjbWN3eXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDk3NjcsImV4cCI6MjA5MDEyNTc2N30.TcUVLIn7i6CNjVAmvILxYcvT5I8uCB3j9wuPQDb1gwE';
  END IF;

  fn_url := 'https://naazebxkoyuxbcmcwytc.supabase.co/functions/v1/send-request-email';
  req_type := sub.payload ->> 'request_type';

  -- Mirror src/lib/pm/requestAliases.ts so replies land in the right inbox.
  reply_to := CASE
    WHEN req_type LIKE 'careersite_%' THEN 'careersite@hireclix.com'
    WHEN req_type IN ('web_edit', 'landing_page') THEN 'web@hireclix.com'
    WHEN req_type IN ('banner_ads', 'social', 'email') THEN 'ads@hireclix.com'
    WHEN req_type IN ('copywriting', 'job_description', 'infographic') THEN 'content@hireclix.com'
    WHEN req_type IN ('recruiter_collateral', 'event_collateral', 'print_collateral', 'swag_apparel') THEN 'creative@hireclix.com'
    WHEN req_type IN ('video_edit', 'photo_retouch', 'presentation') THEN 'media@hireclix.com'
    WHEN req_type = 'brand_assets' THEN 'brand@hireclix.com'
    ELSE 'requests@hireclix.com'
  END;

  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || auth_key,
      'apikey', auth_key
    ),
    body := jsonb_build_object(
      'kind', 'completed',
      'to', sub.submitter_email,
      'refId', 'REQ-' || upper(right(COALESCE(sub.created_project_id::text, NEW.project_id::text), 6)),
      'title', COALESCE(sub.payload ->> 'title', NEW.title),
      'requestType', req_type,
      'projectId', COALESCE(sub.created_project_id::text, NEW.project_id::text),
      'replyTo', reply_to
    )
  );

  UPDATE public.pm_form_submissions
  SET completion_emailed_at = now()
  WHERE id = sub.id;

  RETURN NEW;
END;
$function$;
