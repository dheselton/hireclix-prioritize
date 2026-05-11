
ALTER TABLE public.mock_users ADD COLUMN IF NOT EXISTS avatar_color text;
ALTER TABLE public.mock_users ADD COLUMN IF NOT EXISTS secondary_role text;

ALTER TABLE public.pm_tasks ADD COLUMN IF NOT EXISTS track text NOT NULL DEFAULT 'production';
ALTER TABLE public.pm_template_tasks ADD COLUMN IF NOT EXISTS track text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pm_tasks_track_check') THEN
    ALTER TABLE public.pm_tasks ADD CONSTRAINT pm_tasks_track_check CHECK (track IN ('pm','production'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pm_set_task_track_from_assignee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r text;
BEGIN
  IF NEW.assignee_id IS NULL THEN RETURN NEW; END IF;
  SELECT role INTO r FROM public.mock_users WHERE id = NEW.assignee_id;
  IF r IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN
    RETURN NEW;
  END IF;
  IF r = 'pm' THEN NEW.track := 'pm'; ELSE NEW.track := 'production'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pm_tasks_track_trigger ON public.pm_tasks;
CREATE TRIGGER pm_tasks_track_trigger
  BEFORE INSERT OR UPDATE OF assignee_id ON public.pm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.pm_set_task_track_from_assignee();
