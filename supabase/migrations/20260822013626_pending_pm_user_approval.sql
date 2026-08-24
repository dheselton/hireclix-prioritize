-- New @hireclix.com sign-ins are pending (is_active=false, submitter)
-- until a PM/BA activates them. Existing active roster rows are unchanged.

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
  active boolean;
  display_name text;
BEGIN
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, is_active INTO pm_id, active
  FROM public.pm_users
  WHERE auth_user_id = uid
  LIMIT 1;
  IF pm_id IS NOT NULL THEN
    IF active THEN
      RETURN pm_id;
    END IF;
    RETURN NULL;
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
    AND lower(trim(email)) = em
  RETURNING id, is_active INTO pm_id, active;

  IF pm_id IS NOT NULL THEN
    IF active THEN
      RETURN pm_id;
    END IF;
    RETURN NULL;
  END IF;

  IF split_part(em, '@', 2) <> 'hireclix.com' THEN
    RETURN NULL;
  END IF;

  display_name := COALESCE(
    NULLIF(meta ->> 'full_name', ''),
    NULLIF(meta ->> 'name', ''),
    initcap(replace(split_part(em, '@', 1), '.', ' '))
  );

  INSERT INTO public.pm_users (
    name, email, role, roles, auth_user_id, avatar_url, is_active
  )
  VALUES (
    display_name,
    em,
    'submitter',
    ARRAY['submitter']::text[],
    uid,
    meta ->> 'avatar_url',
    false
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO pm_id;

  IF pm_id IS NULL THEN
    SELECT id, is_active INTO pm_id, active
    FROM public.pm_users
    WHERE auth_user_id = uid
    LIMIT 1;
    IF pm_id IS NOT NULL AND active THEN
      RETURN pm_id;
    END IF;

    SELECT id, is_active INTO pm_id, active
    FROM public.pm_users
    WHERE lower(trim(email)) = em
    LIMIT 1;
    IF pm_id IS NOT NULL THEN
      UPDATE public.pm_users
      SET auth_user_id = uid
      WHERE id = pm_id AND auth_user_id IS NULL;
      IF active THEN
        RETURN pm_id;
      END IF;
    END IF;
  END IF;

  -- Newly created (or pending) rows are not approved until a PM activates them.
  RETURN NULL;
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
  RETURNING id INTO pm_id;

  IF pm_id IS NULL AND split_part(em, '@', 2) = 'hireclix.com' THEN
    display_name := COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      initcap(replace(split_part(em, '@', 1), '.', ' '))
    );

    INSERT INTO public.pm_users (
      name, email, role, roles, auth_user_id, avatar_url, is_active
    )
    VALUES (
      display_name,
      em,
      'submitter',
      ARRAY['submitter']::text[],
      NEW.id,
      NEW.raw_user_meta_data ->> 'avatar_url',
      false
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

CREATE OR REPLACE FUNCTION private.protect_pm_user_privilege_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.roles IS DISTINCT FROM OLD.roles
     OR NEW.secondary_role IS DISTINCT FROM OLD.secondary_role THEN
    IF NOT private.has_pm_role(ARRAY['pm','ba']) THEN
      RAISE EXCEPTION 'Only a PM or BA can change access, role, or activation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_pm_user_privilege_cols ON public.pm_users;
CREATE TRIGGER protect_pm_user_privilege_cols
  BEFORE UPDATE ON public.pm_users
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_pm_user_privilege_cols();

DROP POLICY IF EXISTS "Users can read own pm row" ON public.pm_users;
CREATE POLICY "Users can read own pm row"
  ON public.pm_users FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());
