
CREATE OR REPLACE FUNCTION public.pm_default_task_teams()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.teams IS NULL OR NEW.teams = '{}' THEN
    NEW.teams := CASE NEW.type
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
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pm_tasks_default_teams ON public.pm_tasks;
CREATE TRIGGER pm_tasks_default_teams
  BEFORE INSERT ON public.pm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.pm_default_task_teams();

DROP TRIGGER IF EXISTS pm_template_tasks_default_teams ON public.pm_template_tasks;
CREATE TRIGGER pm_template_tasks_default_teams
  BEFORE INSERT ON public.pm_template_tasks
  FOR EACH ROW EXECUTE FUNCTION public.pm_default_task_teams();
