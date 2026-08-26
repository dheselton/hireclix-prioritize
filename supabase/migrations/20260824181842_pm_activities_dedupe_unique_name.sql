-- Seed insert had no uniqueness, so a later restore/re-apply created a second
-- copy of each default overhead activity. Collapse extras onto the oldest row.

UPDATE public.pm_time_entries e
SET activity_id = keeper.id
FROM public.pm_activities dup
JOIN LATERAL (
  SELECT id
  FROM public.pm_activities a
  WHERE lower(btrim(a.name)) = lower(btrim(dup.name))
  ORDER BY a.created_at, a.id
  LIMIT 1
) keeper ON true
WHERE e.activity_id = dup.id
  AND dup.id <> keeper.id;

UPDATE public.pm_active_timers t
SET activity_id = keeper.id
FROM public.pm_activities dup
JOIN LATERAL (
  SELECT id
  FROM public.pm_activities a
  WHERE lower(btrim(a.name)) = lower(btrim(dup.name))
  ORDER BY a.created_at, a.id
  LIMIT 1
) keeper ON true
WHERE t.activity_id = dup.id
  AND dup.id <> keeper.id;

DELETE FROM public.pm_activities dup
USING (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY lower(btrim(name))
        ORDER BY created_at, id
      ) AS rn
    FROM public.pm_activities
  ) ranked
  WHERE rn > 1
) extra
WHERE dup.id = extra.id;

CREATE UNIQUE INDEX IF NOT EXISTS pm_activities_unique_name_active
  ON public.pm_activities (lower(btrim(name)))
  WHERE NOT is_archived;
