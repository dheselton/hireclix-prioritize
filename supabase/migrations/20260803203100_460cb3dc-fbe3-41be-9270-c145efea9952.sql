CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE public.pm_form_submissions
  ADD COLUMN IF NOT EXISTS completion_emailed_at timestamptz;

CREATE OR REPLACE FUNCTION public.pm_notify_request_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  sub RECORD;
  fn_url text;
  svc_key text;
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
    SELECT decrypted_secret INTO svc_key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    svc_key := NULL;
  END;

  IF svc_key IS NULL THEN
    RAISE LOG 'pm_notify_request_completed: no service role key in vault; skipping email for task %', NEW.id;
    RETURN NEW;
  END IF;

  fn_url := 'https://ybdtzajgkpxsiennooax.supabase.co/functions/v1/send-request-email';
  req_type := sub.payload ->> 'request_type';

  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
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

DROP TRIGGER IF EXISTS pm_tasks_notify_request_completed ON public.pm_tasks;
CREATE TRIGGER pm_tasks_notify_request_completed
AFTER UPDATE OF status ON public.pm_tasks
FOR EACH ROW
EXECUTE FUNCTION public.pm_notify_request_completed();