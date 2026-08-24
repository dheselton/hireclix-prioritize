-- Optional clock range for timer-originated time entries.
-- Manual date-only logs leave these null.

ALTER TABLE public.pm_time_entries
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;
