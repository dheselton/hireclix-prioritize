-- Admin overlay on pm_users (not a job role).
-- Grants all UI surfaces + existing PM/BA DB privileges on top of job roles.
-- Bootstrap: service-role / SQL with no auth.uid() may set is_admin (chicken-and-egg).
-- Do NOT auto-promote every PM.

ALTER TABLE public.pm_users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION private.is_pm_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.pm_users WHERE id = private.current_pm_user_id()),
    false
  );
$$;

-- Operator = PM/BA job OR admin overlay (roster, team time, portal notifs).
CREATE OR REPLACE FUNCTION private.is_pm_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.is_pm_admin() OR private.has_pm_role(ARRAY['pm','ba']);
$$;

REVOKE ALL ON FUNCTION private.is_pm_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_pm_operator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_pm_admin() TO authenticated, postgres, service_role;
GRANT EXECUTE ON FUNCTION private.is_pm_operator() TO authenticated, postgres, service_role;

-- Privilege column protection: PM/BA/admin for access+jobs; only admin for is_admin.
-- When auth.uid() is null (migration / SQL console / service role), allow bootstrap.
CREATE OR REPLACE FUNCTION private.protect_pm_user_privilege_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  -- Service-role / migration path: no JWT → allow (bootstrap first admin, ops SQL).
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT private.is_pm_admin() THEN
      RAISE EXCEPTION 'Only an admin can grant or revoke admin';
    END IF;
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.roles IS DISTINCT FROM OLD.roles
     OR NEW.secondary_role IS DISTINCT FROM OLD.secondary_role THEN
    IF NOT private.is_pm_operator() THEN
      RAISE EXCEPTION 'Only a PM, BA, or admin can change access, role, or activation';
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

-- Roster management: operators (PM/BA/admin)
DROP POLICY IF EXISTS "PMs can manage roster" ON public.pm_users;
DROP POLICY IF EXISTS "Operators can manage roster" ON public.pm_users;
CREATE POLICY "Operators can manage roster"
  ON public.pm_users FOR ALL TO authenticated
  USING (private.is_pm_operator())
  WITH CHECK (private.is_pm_operator());

-- Time entries: operators see/edit all
DROP POLICY IF EXISTS "Own time entries select" ON public.pm_time_entries;
DROP POLICY IF EXISTS "Own time entries update" ON public.pm_time_entries;
DROP POLICY IF EXISTS "Own time entries delete" ON public.pm_time_entries;
CREATE POLICY "Own time entries select" ON public.pm_time_entries FOR SELECT TO authenticated
  USING (user_id = private.current_pm_user_id() OR private.is_pm_operator());
CREATE POLICY "Own time entries update" ON public.pm_time_entries FOR UPDATE TO authenticated
  USING (user_id = private.current_pm_user_id() OR private.is_pm_operator())
  WITH CHECK (user_id = private.current_pm_user_id() OR private.is_pm_operator());
CREATE POLICY "Own time entries delete" ON public.pm_time_entries FOR DELETE TO authenticated
  USING (user_id = private.current_pm_user_id() OR private.is_pm_operator());

-- Portal notifications: operators
DROP POLICY IF EXISTS "Own portal notifications select" ON public.pm_portal_notifications;
DROP POLICY IF EXISTS "Own portal notifications update" ON public.pm_portal_notifications;
DROP POLICY IF EXISTS "Portal notifications delete pm" ON public.pm_portal_notifications;
CREATE POLICY "Own portal notifications select" ON public.pm_portal_notifications FOR SELECT TO authenticated
  USING (user_id = private.current_pm_user_id() OR private.is_pm_operator());
CREATE POLICY "Own portal notifications update" ON public.pm_portal_notifications FOR UPDATE TO authenticated
  USING (user_id = private.current_pm_user_id() OR private.is_pm_operator())
  WITH CHECK (user_id = private.current_pm_user_id() OR private.is_pm_operator());
CREATE POLICY "Portal notifications delete pm" ON public.pm_portal_notifications FOR DELETE TO authenticated
  USING (private.is_pm_operator());
