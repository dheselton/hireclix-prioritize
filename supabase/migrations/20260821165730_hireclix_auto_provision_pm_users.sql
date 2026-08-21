-- Auto-provision pm_users for any @hireclix.com Google sign-in.
-- Domain membership is the allowlist; no pre-maintained roster required.
-- Existing rows still link by email so historical work stays attached.

-- Jill signed in as jill.perrone@ but roster had jillian.perrone@ (with tasks).
UPDATE public.pm_users
SET
  email = 'jill.perrone@hireclix.com',
  auth_user_id = COALESCE(
    auth_user_id,
    '6f5245e8-4b29-4315-89ac-7274ff2d4aa0'::uuid
  )
WHERE lower(trim(email)) = 'jillian.perrone@hireclix.com'
  AND is_active = true;

CREATE OR REPLACE FUNCTION private.claim_pm_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  em text;
  meta jsonb;
  pm_id uuid;
  display_name text;
BEGIN
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO pm_id
  FROM public.pm_users
  WHERE auth_user_id = uid AND is_active = true
  LIMIT 1;
  IF pm_id IS NOT NULL THEN
    RETURN pm_id;
  END IF;

  SELECT lower(trim(email)), raw_user_meta_data
  INTO em, meta
  FROM auth.users
  WHERE id = uid;

  IF em IS NULL OR em = '' THEN
    RETURN NULL;
  END IF;

  UPDATE public.pm_users
  SET
    auth_user_id = uid,
    avatar_url = COALESCE(avatar_url, meta ->> 'avatar_url'),
    name = COALESCE(
      NULLIF(name, ''),
      NULLIF(meta ->> 'full_name', ''),
      NULLIF(meta ->> 'name', ''),
      name
    )
  WHERE auth_user_id IS NULL
    AND is_active = true
    AND lower(trim(email)) = em
  RETURNING id INTO pm_id;

  IF pm_id IS NOT NULL THEN
    RETURN pm_id;
  END IF;

  -- Only HireClix Workspace accounts get an auto-created identity.
  IF split_part(em, '@', 2) <> 'hireclix.com' THEN
    RETURN NULL;
  END IF;

  display_name := COALESCE(
    NULLIF(meta ->> 'full_name', ''),
    NULLIF(meta ->> 'name', ''),
    initcap(replace(split_part(em, '@', 1), '.', ' '))
  );

  INSERT INTO public.pm_users (
    name,
    email,
    role,
    roles,
    auth_user_id,
    avatar_url,
    is_active
  )
  VALUES (
    display_name,
    em,
    'pm',
    ARRAY['pm']::text[],
    uid,
    meta ->> 'avatar_url',
    true
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO pm_id;

  -- Race: another claim may have linked or created the row first.
  IF pm_id IS NULL THEN
    SELECT id INTO pm_id
    FROM public.pm_users
    WHERE auth_user_id = uid AND is_active = true
    LIMIT 1;
  END IF;

  IF pm_id IS NULL THEN
    SELECT id INTO pm_id
    FROM public.pm_users
    WHERE is_active = true AND lower(trim(email)) = em
    LIMIT 1;

    IF pm_id IS NOT NULL THEN
      UPDATE public.pm_users
      SET auth_user_id = uid
      WHERE id = pm_id AND auth_user_id IS NULL;
    END IF;
  END IF;

  RETURN pm_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  em text;
  display_name text;
  pm_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  em := lower(trim(NEW.email));

  UPDATE public.pm_users
  SET
    auth_user_id = NEW.id,
    avatar_url = COALESCE(avatar_url, NEW.raw_user_meta_data ->> 'avatar_url'),
    name = COALESCE(
      NULLIF(name, ''),
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', name)
    )
  WHERE auth_user_id IS NULL
    AND lower(trim(email)) = em
    AND is_active = true
  RETURNING id INTO pm_id;

  IF pm_id IS NULL AND split_part(em, '@', 2) = 'hireclix.com' THEN
    display_name := COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      initcap(replace(split_part(em, '@', 1), '.', ' '))
    );

    INSERT INTO public.pm_users (
      name,
      email,
      role,
      roles,
      auth_user_id,
      avatar_url,
      is_active
    )
    VALUES (
      display_name,
      em,
      'pm',
      ARRAY['pm']::text[],
      NEW.id,
      NEW.raw_user_meta_data ->> 'avatar_url',
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.claim_pm_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.claim_pm_user() TO authenticated, postgres, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;
