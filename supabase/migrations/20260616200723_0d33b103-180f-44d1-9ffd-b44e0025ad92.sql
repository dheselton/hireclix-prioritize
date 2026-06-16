
-- 1) Expand allowed mock_users.role values
ALTER TABLE public.mock_users DROP CONSTRAINT IF EXISTS mock_users_role_check;
ALTER TABLE public.mock_users ADD CONSTRAINT mock_users_role_check
  CHECK (role IN ('pm','designer','developer','submitter','strategist','analyst','qa','csm','support'));

-- 2) Add teams[] to tasks & template tasks
ALTER TABLE public.pm_tasks ADD COLUMN IF NOT EXISTS teams text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.pm_template_tasks ADD COLUMN IF NOT EXISTS teams text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS pm_tasks_teams_gin ON public.pm_tasks USING gin(teams);
CREATE INDEX IF NOT EXISTS pm_template_tasks_teams_gin ON public.pm_template_tasks USING gin(teams);

-- 3) Backfill teams from type for any empty rows
UPDATE public.pm_tasks SET teams = CASE type
    WHEN 'design' THEN ARRAY['design']
    WHEN 'content' THEN ARRAY['design']
    WHEN 'dev' THEN ARRAY['dev']
    WHEN 'qa' THEN ARRAY['qa']
    WHEN 'review' THEN ARRAY['pm']
    WHEN 'approval' THEN ARRAY['pm']
    WHEN 'strategy' THEN ARRAY['strategy']
    WHEN 'research' THEN ARRAY['strategy']
    WHEN 'analytics' THEN ARRAY['analytics']
    WHEN 'reporting' THEN ARRAY['analytics']
    ELSE ARRAY[]::text[]
  END
WHERE teams = '{}';

UPDATE public.pm_template_tasks SET teams = CASE type
    WHEN 'design' THEN ARRAY['design']
    WHEN 'content' THEN ARRAY['design']
    WHEN 'dev' THEN ARRAY['dev']
    WHEN 'qa' THEN ARRAY['qa']
    WHEN 'review' THEN ARRAY['pm']
    WHEN 'approval' THEN ARRAY['pm']
    WHEN 'strategy' THEN ARRAY['strategy']
    WHEN 'research' THEN ARRAY['strategy']
    WHEN 'analytics' THEN ARRAY['analytics']
    WHEN 'reporting' THEN ARRAY['analytics']
    ELSE ARRAY[]::text[]
  END
WHERE teams = '{}';

-- 4) Extend track-derivation trigger for new roles
CREATE OR REPLACE FUNCTION public.pm_set_task_track_from_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF r = 'pm' OR r = 'csm' THEN NEW.track := 'pm';
  ELSIF r = 'strategist' THEN NEW.track := 'strategy';
  ELSIF r = 'analyst' THEN NEW.track := 'analytics';
  ELSE NEW.track := 'production';
  END IF;
  RETURN NEW;
END;
$$;
