-- Canonical clients + users: merge duplicate HireClix, enforce uniqueness,
-- retire redundant team_members roster in favor of pm_users.

-- ---------------------------------------------------------------------------
-- 1) Fail closed if unexpected duplicate groups exist
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  unexpected_clients integer;
  unexpected_pm_emails integer;
  missing_team integer;
BEGIN
  SELECT count(*) INTO unexpected_clients
  FROM (
    SELECT 1
    FROM public.clients
    GROUP BY lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
    HAVING count(*) > 1
       AND lower(regexp_replace(trim(min(name)), '\s+', ' ', 'g')) <> 'hireclix'
  ) s;

  IF unexpected_clients > 0 THEN
    RAISE EXCEPTION
      'Refusing canonical migration: % unexpected client name duplicate group(s)',
      unexpected_clients;
  END IF;

  SELECT count(*) INTO unexpected_pm_emails
  FROM (
    SELECT 1
    FROM public.pm_users
    WHERE nullif(trim(email), '') IS NOT NULL
    GROUP BY lower(trim(email))
    HAVING count(*) > 1
  ) s;

  IF unexpected_pm_emails > 0 THEN
    RAISE EXCEPTION
      'Refusing canonical migration: % duplicate pm_users email group(s)',
      unexpected_pm_emails;
  END IF;

  SELECT count(*) INTO missing_team
  FROM public.team_members t
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.pm_users p
    WHERE lower(trim(p.email)) = lower(trim(t.email))
  );

  IF missing_team > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop team_members: % row(s) have no matching pm_users email',
      missing_team;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Merge known HireClix duplicates (keep oldest canonical row)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  canonical_id uuid := '19906f52-f6df-4d45-bfcb-116c5d4b8735';
  duplicate_id uuid := 'cfa3ce87-d424-484a-b736-1e60c7e51ba7';
  canon_exists boolean;
  dup_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.clients WHERE id = canonical_id) INTO canon_exists;
  SELECT EXISTS (SELECT 1 FROM public.clients WHERE id = duplicate_id) INTO dup_exists;

  IF NOT canon_exists THEN
    -- Fall back: earliest HireClix-like row becomes canonical
    SELECT id INTO canonical_id
    FROM public.clients
    WHERE lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = 'hireclix'
    ORDER BY created_at ASC
    LIMIT 1;

    IF canonical_id IS NULL THEN
      RAISE EXCEPTION 'No HireClix client found to use as canonical';
    END IF;
  END IF;

  IF dup_exists AND duplicate_id <> canonical_id THEN
    -- SET NULL tables → re-point
    UPDATE public.pm_projects SET client_id = canonical_id WHERE client_id = duplicate_id;
    UPDATE public.pm_forms SET client_id = canonical_id WHERE client_id = duplicate_id;
    UPDATE public.pm_portal_access SET client_id = canonical_id WHERE client_id = duplicate_id;
    UPDATE public.pm_activities SET default_client_id = canonical_id WHERE default_client_id = duplicate_id;

    -- Watchers: drop conflicts, then re-point
    DELETE FROM public.pm_client_watchers dup
    USING public.pm_client_watchers canon
    WHERE dup.client_id = duplicate_id
      AND canon.client_id = canonical_id
      AND dup.user_id = canon.user_id
      AND COALESCE(dup.request_type, '') = COALESCE(canon.request_type, '');

    UPDATE public.pm_client_watchers SET client_id = canonical_id WHERE client_id = duplicate_id;

    -- CASCADE child tables → re-point (preserve rows)
    UPDATE public.pm_client_environments SET client_id = canonical_id WHERE client_id = duplicate_id;
    UPDATE public.pm_client_notes SET client_id = canonical_id WHERE client_id = duplicate_id;
    UPDATE public.pm_client_assets SET client_id = canonical_id WHERE client_id = duplicate_id;

    DELETE FROM public.clients WHERE id = duplicate_id;
  END IF;

  -- Collapse any remaining HireClix-normalized duplicates into canonical
  FOR duplicate_id IN
    SELECT id
    FROM public.clients
    WHERE id <> canonical_id
      AND lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = 'hireclix'
  LOOP
    UPDATE public.pm_projects SET client_id = canonical_id WHERE client_id = duplicate_id;
    UPDATE public.pm_forms SET client_id = canonical_id WHERE client_id = duplicate_id;
    UPDATE public.pm_portal_access SET client_id = canonical_id WHERE client_id = duplicate_id;
    UPDATE public.pm_activities SET default_client_id = canonical_id WHERE default_client_id = duplicate_id;

    DELETE FROM public.pm_client_watchers dup
    USING public.pm_client_watchers canon
    WHERE dup.client_id = duplicate_id
      AND canon.client_id = canonical_id
      AND dup.user_id = canon.user_id
      AND COALESCE(dup.request_type, '') = COALESCE(canon.request_type, '');

    UPDATE public.pm_client_watchers SET client_id = canonical_id WHERE client_id = duplicate_id;
    UPDATE public.pm_client_environments SET client_id = canonical_id WHERE client_id = duplicate_id;
    UPDATE public.pm_client_notes SET client_id = canonical_id WHERE client_id = duplicate_id;
    UPDATE public.pm_client_assets SET client_id = canonical_id WHERE client_id = duplicate_id;

    DELETE FROM public.clients WHERE id = duplicate_id;
  END LOOP;

  UPDATE public.clients
  SET name = 'HireClix', is_internal = true, archived_at = NULL
  WHERE id = canonical_id;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Deduplicate portal contacts before unique index (keep earliest)
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY client_id, lower(trim(email))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.pm_portal_access
  WHERE client_id IS NOT NULL
    AND nullif(trim(email), '') IS NOT NULL
)
DELETE FROM public.pm_portal_access p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- ---------------------------------------------------------------------------
-- 4) Uniqueness guards (source of truth)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS clients_name_normalized_unique
  ON public.clients (lower(regexp_replace(trim(name), '\s+', ' ', 'g')));

CREATE UNIQUE INDEX IF NOT EXISTS pm_users_email_normalized_unique
  ON public.pm_users (lower(trim(email)))
  WHERE nullif(trim(email), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pm_portal_access_client_email_unique
  ON public.pm_portal_access (client_id, lower(trim(email)))
  WHERE client_id IS NOT NULL
    AND nullif(trim(email), '') IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5) Retire redundant roadmap roster (pm_users is canonical)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.team_members;
