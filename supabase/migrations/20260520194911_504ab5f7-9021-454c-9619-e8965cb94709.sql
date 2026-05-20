
ALTER TABLE public.pm_template_page_groups
  ADD COLUMN IF NOT EXISTS discovery_task_temp_id text,
  ADD COLUMN IF NOT EXISTS expected_page_count integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS parallel_cap integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS reserved_by_phase jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS allow_late_definition boolean NOT NULL DEFAULT true;

ALTER TABLE public.pm_projects
  ADD COLUMN IF NOT EXISTS page_group_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pages_locked_at timestamptz;
