-- Track when task/project status last changed for status-clock badges.

ALTER TABLE public.pm_tasks
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

ALTER TABLE public.pm_projects
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

-- Backfill tasks from latest status-change activity, else updated_at / created_at.
UPDATE public.pm_tasks t
SET status_changed_at = COALESCE(
  (
    SELECT al.created_at
    FROM public.pm_activity_log al
    WHERE al.task_id = t.id
      AND al.action = 'task.status_changed'
    ORDER BY al.created_at DESC
    LIMIT 1
  ),
  t.updated_at,
  t.created_at
)
WHERE t.status_changed_at IS NULL;

-- Backfill projects from updated_at / created_at (no project.status_changed action yet).
UPDATE public.pm_projects p
SET status_changed_at = COALESCE(p.updated_at, p.created_at)
WHERE p.status_changed_at IS NULL;

-- Stamp on create.
ALTER TABLE public.pm_tasks
  ALTER COLUMN status_changed_at SET DEFAULT now();

ALTER TABLE public.pm_projects
  ALTER COLUMN status_changed_at SET DEFAULT now();

-- Keep status_changed_at in sync even when status is updated outside api.ts.
CREATE OR REPLACE FUNCTION public.pm_stamp_status_changed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status_changed_at IS NULL THEN
      NEW.status_changed_at := COALESCE(NEW.updated_at, NEW.created_at, now());
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pm_tasks_stamp_status_changed_at ON public.pm_tasks;
CREATE TRIGGER pm_tasks_stamp_status_changed_at
  BEFORE INSERT OR UPDATE ON public.pm_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_stamp_status_changed_at();

DROP TRIGGER IF EXISTS pm_projects_stamp_status_changed_at ON public.pm_projects;
CREATE TRIGGER pm_projects_stamp_status_changed_at
  BEFORE INSERT OR UPDATE ON public.pm_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_stamp_status_changed_at();
