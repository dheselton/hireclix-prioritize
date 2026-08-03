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

  IF auth_key IS NULL THEN
    auth_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliZHR6YWpna3B4c2llbm5vb2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDI4NzAsImV4cCI6MjA5MzgxODg3MH0.xOVUi4x1qHvV4pe45N11Wo7CH8bUcRndDNeE--VsrRU';
  END IF;

  fn_url := 'https://ybdtzajgkpxsiennooax.supabase.co/functions/v1/send-request-email';
  req_type := sub.payload ->> 'request_type';

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
      'projectId', COALESCE(sub.created_project_id::text, NEW.project_id::text)
    )
  );

  UPDATE public.pm_form_submissions
  SET completion_emailed_at = now()
  WHERE id = sub.id;

  RETURN NEW;
END;
$function$;