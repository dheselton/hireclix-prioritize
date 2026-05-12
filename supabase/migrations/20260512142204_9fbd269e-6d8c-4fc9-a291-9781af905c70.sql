CREATE OR REPLACE FUNCTION public.pm_set_task_track_from_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r text;
BEGIN
  -- Status follow-through based on assignee changes
  IF TG_OP = 'INSERT' THEN
    IF NEW.assignee_id IS NOT NULL AND NEW.status = 'unclaimed' THEN
      NEW.status := 'claimed';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      IF NEW.assignee_id IS NOT NULL AND NEW.status = 'unclaimed' THEN
        NEW.status := 'claimed';
      ELSIF NEW.assignee_id IS NULL AND NEW.status = 'claimed' THEN
        NEW.status := 'unclaimed';
      END IF;
    END IF;
  END IF;

  -- Track derivation from assignee role
  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN
    RETURN NEW;
  END IF;
  SELECT role INTO r FROM public.mock_users WHERE id = NEW.assignee_id;
  IF r IS NULL THEN RETURN NEW; END IF;
  IF r = 'pm' THEN NEW.track := 'pm'; ELSE NEW.track := 'production'; END IF;
  RETURN NEW;
END;
$function$;

-- Make sure trigger is attached (idempotent)
DROP TRIGGER IF EXISTS pm_set_task_track_from_assignee_trg ON public.pm_tasks;
CREATE TRIGGER pm_set_task_track_from_assignee_trg
BEFORE INSERT OR UPDATE ON public.pm_tasks
FOR EACH ROW EXECUTE FUNCTION public.pm_set_task_track_from_assignee();