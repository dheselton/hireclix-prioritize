-- Backfill missing pm_users.avatar_url from Google OAuth metadata, and keep
-- claim_pm_user / handle_new_user filling blank avatars on every sign-in
-- without overwriting a custom upload.

-- One-time backfill for already-linked rows that never got an avatar.
UPDATE public.pm_users pu
SET avatar_url = COALESCE(
  NULLIF(trim(au.raw_user_meta_data ->> 'avatar_url'), ''),
  NULLIF(trim(au.raw_user_meta_data ->> 'picture'), '')
)
FROM auth.users au
WHERE pu.auth_user_id = au.id
  AND (pu.avatar_url IS NULL OR trim(pu.avatar_url) = '')
  AND (
    NULLIF(trim(au.raw_user_meta_data ->> 'avatar_url'), '') IS NOT NULL
    OR NULLIF(trim(au.raw_user_meta_data ->> 'picture'), '') IS NOT NULL
  );

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
  oauth_avatar text;
BEGIN
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT lower(trim(email)), raw_user_meta_data
  INTO em, meta
  FROM auth.users
  WHERE id = uid;

  oauth_avatar := COALESCE(
    NULLIF(trim(meta ->> 'avatar_url'), ''),
    NULLIF(trim(meta ->> 'picture'), '')
  );

  SELECT id, is_active INTO pm_id, active
  FROM public.pm_users
  WHERE auth_user_id = uid
  LIMIT 1;
  IF pm_id IS NOT NULL THEN
    -- Already linked: fill blank avatar from OAuth, never clobber a custom upload.
    IF oauth_avatar IS NOT NULL THEN
      UPDATE public.pm_users
      SET avatar_url = oauth_avatar
      WHERE id = pm_id
        AND (avatar_url IS NULL OR trim(avatar_url) = '');
    END IF;
    IF active THEN
      RETURN pm_id;
    END IF;
    RETURN NULL;
  END IF;

  IF em IS NULL OR em = '' THEN
    RETURN NULL;
  END IF;

  UPDATE public.pm_users
  SET
    auth_user_id = uid,
    avatar_url = COALESCE(NULLIF(trim(avatar_url), ''), oauth_avatar),
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
    oauth_avatar,
    false
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO pm_id;

  IF pm_id IS NULL THEN
    SELECT id, is_active INTO pm_id, active
    FROM public.pm_users
    WHERE auth_user_id = uid
    LIMIT 1;
    IF pm_id IS NOT NULL THEN
      IF oauth_avatar IS NOT NULL THEN
        UPDATE public.pm_users
        SET avatar_url = oauth_avatar
        WHERE id = pm_id
          AND (avatar_url IS NULL OR trim(avatar_url) = '');
      END IF;
      IF active THEN
        RETURN pm_id;
      END IF;
      RETURN NULL;
    END IF;

    SELECT id, is_active INTO pm_id, active
    FROM public.pm_users
    WHERE lower(trim(email)) = em
    LIMIT 1;
    IF pm_id IS NOT NULL THEN
      UPDATE public.pm_users
      SET
        auth_user_id = uid,
        avatar_url = COALESCE(NULLIF(trim(avatar_url), ''), oauth_avatar)
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
  oauth_avatar text;
BEGIN
  oauth_avatar := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data ->> 'avatar_url'), ''),
    NULLIF(trim(NEW.raw_user_meta_data ->> 'picture'), '')
  );

  INSERT INTO public.profiles (user_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    oauth_avatar
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(
      NULLIF(trim(public.profiles.avatar_url), ''),
      EXCLUDED.avatar_url
    ),
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
    avatar_url = COALESCE(NULLIF(trim(avatar_url), ''), oauth_avatar),
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
      oauth_avatar,
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

-- So roster clients receive avatar/name updates without a full reload.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pm_users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_users;
  END IF;
END;
$$;
