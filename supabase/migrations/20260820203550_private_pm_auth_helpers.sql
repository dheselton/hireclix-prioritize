-- Move auth helpers into private schema (not exposed via PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, postgres, service_role;

CREATE OR REPLACE FUNCTION private.current_pm_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.pm_users
  WHERE auth_user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.current_pm_roles()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN roles IS NOT NULL AND cardinality(roles) > 0 THEN roles
    ELSE ARRAY[role]::text[]
  END
  FROM public.pm_users
  WHERE id = private.current_pm_user_id();
$$;

CREATE OR REPLACE FUNCTION private.has_pm_role(roles_needed text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT private.current_pm_roles() && roles_needed), false);
$$;

CREATE OR REPLACE FUNCTION private.is_approved_pm_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.current_pm_user_id() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION private.claim_pm_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  em text;
  pm_id uuid;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO pm_id FROM public.pm_users WHERE auth_user_id = uid AND is_active = true LIMIT 1;
  IF pm_id IS NOT NULL THEN RETURN pm_id; END IF;
  SELECT lower(email) INTO em FROM auth.users WHERE id = uid;
  IF em IS NULL THEN RETURN NULL; END IF;
  UPDATE public.pm_users
  SET auth_user_id = uid
  WHERE auth_user_id IS NULL AND is_active = true AND lower(email) = em
  RETURNING id INTO pm_id;
  RETURN pm_id;
END;
$$;

REVOKE ALL ON FUNCTION private.current_pm_user_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_pm_roles() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_pm_role(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_approved_pm_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.claim_pm_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_pm_user_id() TO authenticated, postgres, service_role;
GRANT EXECUTE ON FUNCTION private.current_pm_roles() TO authenticated, postgres, service_role;
GRANT EXECUTE ON FUNCTION private.has_pm_role(text[]) TO authenticated, postgres, service_role;
GRANT EXECUTE ON FUNCTION private.is_approved_pm_user() TO authenticated, postgres, service_role;
GRANT EXECUTE ON FUNCTION private.claim_pm_user() TO authenticated, postgres, service_role;
