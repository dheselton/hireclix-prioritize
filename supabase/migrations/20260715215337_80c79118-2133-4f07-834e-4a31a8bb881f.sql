CREATE OR REPLACE FUNCTION public.pm_set_task_track_from_assignee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r text;
BEGIN
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

  IF NEW.assignee_id IS NULL THEN
    IF NEW.type IN ('strategy','research') THEN NEW.track := 'strategy';
    ELSIF NEW.type IN ('analytics','reporting') THEN NEW.track := 'analytics';
    ELSIF NEW.type IN ('review','approval') AND NEW.track IS NULL THEN NEW.track := 'pm';
    ELSIF NEW.track IS NULL THEN NEW.track := 'production';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN
    RETURN NEW;
  END IF;

  SELECT role INTO r FROM public.mock_users WHERE id = NEW.assignee_id;
  IF r IS NULL THEN RETURN NEW; END IF;

  IF r = 'pm' OR r = 'csm' OR r = 'ba' THEN NEW.track := 'pm';
  ELSIF r = 'strategist' THEN NEW.track := 'strategy';
  ELSIF r = 'analyst' THEN NEW.track := 'analytics';
  ELSE NEW.track := 'production';
  END IF;
  RETURN NEW;
END;
$function$;