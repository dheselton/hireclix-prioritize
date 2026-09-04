-- Track due-date slippage: original date + how many times it was pushed.

ALTER TABLE public.pm_tasks
  ADD COLUMN IF NOT EXISTS original_due_date date,
  ADD COLUMN IF NOT EXISTS due_date_changes integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.pm_tasks.original_due_date IS
  'First non-null due_date ever set on this task; preserved when due_date is pushed.';
COMMENT ON COLUMN public.pm_tasks.due_date_changes IS
  'Count of times due_date was changed after the original was set.';

-- Backfill: treat current due_date as original when never tracked.
UPDATE public.pm_tasks
SET original_due_date = due_date
WHERE due_date IS NOT NULL
  AND original_due_date IS NULL;
