-- Merge Careers-suffix client aliases onto brand clients and enforce stem uniqueness.
-- Do NOT merge CHS ↔ Community Health Systems (different companies).

-- ---------------------------------------------------------------------------
-- 1) Helper: re-point all FK refs from duplicate → keeper, then delete duplicate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_merge_client(keeper_id uuid, duplicate_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  keeper_logo text;
  dup_logo text;
BEGIN
  IF keeper_id IS NULL OR duplicate_id IS NULL OR keeper_id = duplicate_id THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = keeper_id) THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = duplicate_id) THEN
    RETURN;
  END IF;

  -- Prefer keeper logo; copy from alias if keeper has none
  SELECT logo_path INTO keeper_logo FROM public.clients WHERE id = keeper_id;
  SELECT logo_path INTO dup_logo FROM public.clients WHERE id = duplicate_id;
  IF (keeper_logo IS NULL OR keeper_logo = '') AND dup_logo IS NOT NULL AND dup_logo <> '' THEN
    UPDATE public.clients SET logo_path = dup_logo WHERE id = keeper_id;
  END IF;

  UPDATE public.pm_projects SET client_id = keeper_id WHERE client_id = duplicate_id;
  UPDATE public.pm_forms SET client_id = keeper_id WHERE client_id = duplicate_id;
  UPDATE public.pm_portal_access SET client_id = keeper_id WHERE client_id = duplicate_id;
  UPDATE public.pm_activities SET default_client_id = keeper_id WHERE default_client_id = duplicate_id;
  UPDATE public.pm_ops_sites SET client_id = keeper_id WHERE client_id = duplicate_id;

  DELETE FROM public.pm_client_watchers dup
  USING public.pm_client_watchers canon
  WHERE dup.client_id = duplicate_id
    AND canon.client_id = keeper_id
    AND dup.user_id = canon.user_id
    AND COALESCE(dup.request_type, '') = COALESCE(canon.request_type, '');

  UPDATE public.pm_client_watchers SET client_id = keeper_id WHERE client_id = duplicate_id;
  UPDATE public.pm_client_environments SET client_id = keeper_id WHERE client_id = duplicate_id;
  UPDATE public.pm_client_notes SET client_id = keeper_id WHERE client_id = duplicate_id;
  UPDATE public.pm_client_assets SET client_id = keeper_id WHERE client_id = duplicate_id;

  DELETE FROM public.clients WHERE id = duplicate_id;
END;
$$;

-- Normalized name key (matches clients_name_normalized_unique)
CREATE OR REPLACE FUNCTION public.pm_client_name_key(n text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(trim(COALESCE(n, '')), '\s+', ' ', 'g'));
$$;

-- Brand stem: strip trailing careers / jobs / career site(s)
CREATE OR REPLACE FUNCTION public.pm_client_name_stem(n text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      trim(
        regexp_replace(
          regexp_replace(public.pm_client_name_key(n), '\s+career\s+sites?$', '', 'i'),
          '\s+(careers|jobs)$',
          '',
          'i'
        )
      ),
      ''
    ),
    public.pm_client_name_key(n)
  );
$$;

-- ---------------------------------------------------------------------------
-- 2) Named merges
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  keeper uuid;
  alias_id uuid;
  penfed_plain uuid;
  penfed_careers uuid;
  plain_projects int;
BEGIN
  -- Parsons Careers → Parsons
  SELECT id INTO keeper FROM public.clients
  WHERE public.pm_client_name_key(name) = 'parsons' LIMIT 1;
  SELECT id INTO alias_id FROM public.clients
  WHERE public.pm_client_name_key(name) = 'parsons careers' LIMIT 1;
  IF keeper IS NOT NULL AND alias_id IS NOT NULL THEN
    PERFORM public.pm_merge_client(keeper, alias_id);
  END IF;

  -- Resideo Careers → Resideo
  keeper := NULL; alias_id := NULL;
  SELECT id INTO keeper FROM public.clients
  WHERE public.pm_client_name_key(name) = 'resideo' LIMIT 1;
  SELECT id INTO alias_id FROM public.clients
  WHERE public.pm_client_name_key(name) = 'resideo careers' LIMIT 1;
  IF keeper IS NOT NULL AND alias_id IS NOT NULL THEN
    PERFORM public.pm_merge_client(keeper, alias_id);
  END IF;

  -- Mobility Global Careers → Mobility Global
  keeper := NULL; alias_id := NULL;
  SELECT id INTO keeper FROM public.clients
  WHERE public.pm_client_name_key(name) = 'mobility global' LIMIT 1;
  SELECT id INTO alias_id FROM public.clients
  WHERE public.pm_client_name_key(name) = 'mobility global careers' LIMIT 1;
  IF keeper IS NOT NULL AND alias_id IS NOT NULL THEN
    PERFORM public.pm_merge_client(keeper, alias_id);
  END IF;

  -- Penfed: prefer the row with projects as keeper; rename to Penfed
  penfed_plain := NULL; penfed_careers := NULL;
  SELECT id INTO penfed_plain FROM public.clients
  WHERE public.pm_client_name_key(name) = 'penfed' LIMIT 1;
  SELECT id INTO penfed_careers FROM public.clients
  WHERE public.pm_client_name_key(name) = 'penfed careers' LIMIT 1;

  IF penfed_plain IS NOT NULL AND penfed_careers IS NOT NULL THEN
    SELECT count(*) INTO plain_projects FROM public.pm_projects WHERE client_id = penfed_plain;
    IF plain_projects = 0 THEN
      -- Empty Penfed row loses; keep Penfed Careers then rename
      PERFORM public.pm_merge_client(penfed_careers, penfed_plain);
      UPDATE public.clients SET name = 'Penfed' WHERE id = penfed_careers;
    ELSE
      PERFORM public.pm_merge_client(penfed_plain, penfed_careers);
      UPDATE public.clients SET name = 'Penfed' WHERE id = penfed_plain;
    END IF;
  ELSIF penfed_careers IS NOT NULL AND penfed_plain IS NULL THEN
    UPDATE public.clients SET name = 'Penfed' WHERE id = penfed_careers;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2b) Collapse any remaining Careers/Jobs stem collisions before unique index
-- Prefer the row whose exact key equals the stem (brand name); else most projects.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  keeper uuid;
  loser uuid;
BEGIN
  FOR r IN
    SELECT public.pm_client_name_stem(name) AS stem
    FROM public.clients
    GROUP BY public.pm_client_name_stem(name)
    HAVING count(*) > 1
  LOOP
    SELECT c.id INTO keeper
    FROM public.clients c
    WHERE public.pm_client_name_stem(c.name) = r.stem
    ORDER BY
      CASE WHEN public.pm_client_name_key(c.name) = r.stem THEN 0 ELSE 1 END,
      (SELECT count(*) FROM public.pm_projects p WHERE p.client_id = c.id) DESC,
      c.created_at ASC NULLS LAST,
      c.id ASC
    LIMIT 1;

    FOR loser IN
      SELECT c.id FROM public.clients c
      WHERE public.pm_client_name_stem(c.name) = r.stem
        AND c.id <> keeper
    LOOP
      PERFORM public.pm_merge_client(keeper, loser);
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Stem unique index (blocks parsons vs parsons careers going forward)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS clients_name_stem_unique
  ON public.clients (public.pm_client_name_stem(name));
