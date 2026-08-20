-- Real users + enforced access
-- 1) Rename mock_users -> pm_users (preserve UUIDs / FKs)
-- 2) Link auth.users via auth_user_id
-- 3) Remove unused placeholder users
-- 4) Replace permissive public policies with authenticated shared-workspace RLS
-- 5) Keep narrow anon access for public forms; portal continues via service-role edge fn

-- ---------------------------------------------------------------------------
-- Identity: rename + link column
-- ---------------------------------------------------------------------------
ALTER TABLE public.mock_users RENAME TO pm_users;

ALTER TABLE public.pm_users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Expand role vocabulary to match the app
ALTER TABLE public.pm_users DROP CONSTRAINT IF EXISTS mock_users_role_check;
ALTER TABLE public.pm_users DROP CONSTRAINT IF EXISTS pm_users_role_check;
ALTER TABLE public.pm_users
  ADD CONSTRAINT pm_users_role_check
  CHECK (role IN (
    'pm','designer','developer','submitter','strategist','analyst',
    'qa','csm','support','ba','tech_lead'
  ));

-- Link already-signed-in HireClix accounts by email (case-insensitive)
UPDATE public.pm_users pu
SET auth_user_id = au.id
FROM auth.users au
WHERE pu.auth_user_id IS NULL
  AND pu.email IS NOT NULL
  AND lower(pu.email) = lower(au.email);

-- Abort if any non-HireClix placeholder still owns work (FK or loose UUID cols)
DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count
  FROM public.pm_users pu
  WHERE (pu.email IS NULL OR pu.email NOT ILIKE '%@hireclix.com')
    AND (
      EXISTS (SELECT 1 FROM public.pm_tasks t WHERE t.assignee_id = pu.id OR t.created_by = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_task_assignees a WHERE a.user_id = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_project_members m WHERE m.user_id = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_comments c WHERE c.user_id = pu.id OR pu.id = ANY (c.mentions))
      OR EXISTS (SELECT 1 FROM public.pm_time_entries te WHERE te.user_id = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_activity_log al WHERE al.user_id = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_notifications n WHERE n.user_id = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_user_pinned_tasks p WHERE p.user_id = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_task_watchers w WHERE w.user_id = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_notification_prefs np WHERE np.user_id = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_client_watchers cw WHERE cw.user_id = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_portal_messages pm WHERE pm.author_user_id = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_portal_notifications pn WHERE pn.user_id = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_attachments att WHERE att.uploaded_by = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_projects pr WHERE pr.created_by = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_notes n WHERE n.user_id = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_active_timers t WHERE t.user_id = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_task_links l WHERE l.created_by = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_activities a WHERE a.created_by = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_snippets s WHERE s.created_by = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_task_snippets ts WHERE ts.linked_by = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_client_notes cn WHERE cn.author_id = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_client_assets ca WHERE ca.uploaded_by = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_snippet_incidents si WHERE si.reported_by = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_portal_access pa WHERE pa.created_by = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_project_attachments pa WHERE pa.uploaded_by = pu.id)
      OR EXISTS (SELECT 1 FROM public.pm_dev_status_log d WHERE d.author_id = pu.id)
    );

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Refusing to delete placeholder users: % still own work', bad_count;
  END IF;

  DELETE FROM public.pm_users
  WHERE email IS NULL OR email NOT ILIKE '%@hireclix.com';
END $$;

-- ---------------------------------------------------------------------------
-- Auth helpers (SECURITY DEFINER, revoked from anon/authenticated RPC)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_pm_user_id()
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

CREATE OR REPLACE FUNCTION public.current_pm_roles()
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
  WHERE id = public.current_pm_user_id();
$$;

CREATE OR REPLACE FUNCTION public.has_pm_role(roles_needed text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT public.current_pm_roles() && roles_needed),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_pm_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_pm_user_id() IS NOT NULL;
$$;

-- Link roster member on signup / first auth when email matches
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF NEW.email IS NOT NULL THEN
    UPDATE public.pm_users
    SET
      auth_user_id = NEW.id,
      avatar_url = COALESCE(avatar_url, NEW.raw_user_meta_data ->> 'avatar_url'),
      name = COALESCE(NULLIF(name, ''), COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', name))
    WHERE auth_user_id IS NULL
      AND lower(email) = lower(NEW.email)
      AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$;

-- Keep trigger function reading pm_users
CREATE OR REPLACE FUNCTION public.pm_set_task_track_from_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assignee_id IS NOT NULL AND NEW.status = 'unclaimed' THEN
      NEW.status := 'claimed';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      IF NEW.assignee_id IS NOT NULL AND NEW.status = 'unclaimed' THEN
        NEW.status := 'claimed';
      ELSIF NEW.assignee_id IS NULL AND NEW.status = 'claimed' THEN
        NEW.status := 'unclaimed';
      END IF;
    END IF;
  END IF;

  IF NEW.assignee_id IS NULL THEN
    IF NEW.type IN ('strategy','research') THEN NEW.track := 'strategy';
    ELSIF NEW.type IN ('analytics','reporting') THEN NEW.track := 'analytics';
    ELSIF NEW.type IN ('review','approval') AND NEW.track IS NULL THEN NEW.track := 'pm';
    ELSIF NEW.track IS NULL THEN NEW.track := 'production';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN
    RETURN NEW;
  END IF;

  SELECT role INTO r FROM public.pm_users WHERE id = NEW.assignee_id;
  IF r IS NULL THEN RETURN NEW; END IF;

  IF r IN ('pm','csm','ba') THEN NEW.track := 'pm';
  ELSIF r = 'strategist' THEN NEW.track := 'strategy';
  ELSIF r = 'analyst' THEN NEW.track := 'analytics';
  ELSE NEW.track := 'production';
  END IF;
  RETURN NEW;
END;
$$;

-- Revoke direct EXECUTE on privileged helpers from API roles
REVOKE ALL ON FUNCTION public.current_pm_user_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_pm_roles() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_pm_role(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_approved_pm_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pm_set_task_track_from_assignee() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pm_default_task_teams() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pm_notify_request_completed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_job_api_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_features_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Policies need to call these helpers
GRANT EXECUTE ON FUNCTION public.current_pm_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_pm_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_pm_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_pm_user() TO authenticated;

-- ---------------------------------------------------------------------------
-- Drop all existing policies on PM / shared tables, then recreate
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'pm_users','clients','pm_projects','pm_project_members','pm_project_phases',
        'pm_tasks','pm_task_dependencies','pm_subtasks','pm_checklist_items',
        'pm_time_entries','pm_attachments','pm_comments','pm_activity_log',
        'pm_notifications','pm_forms','pm_form_fields','pm_form_submissions',
        'pm_webhooks','pm_webhook_deliveries','pm_client_environments',
        'pm_project_templates','pm_template_tasks','pm_template_dependencies',
        'pm_design_rounds','pm_dev_status_log','pm_project_attachments','pm_task_links',
        'pm_active_timers','pm_snippet_categories','pm_snippets','pm_snippet_variations',
        'pm_task_snippets','pm_template_task_snippets','pm_template_page_groups',
        'pm_template_page_presets','pm_notes','pm_project_links','pm_task_assignees',
        'pm_client_watchers','pm_snippet_incidents','pm_activities','pm_user_pinned_tasks',
        'pm_notification_prefs','pm_tag_catalog','pm_task_watchers','pm_portal_access',
        'pm_portal_messages','pm_portal_notifications','pm_client_notes','pm_client_assets'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Helper: approved authenticated staff
-- Shared workspace: approved users can read/write collaborative PM data.
-- Personal tables are scoped to current_pm_user_id().
-- PM/BA retain team-wide personal-data reads where the UI already supports it.

-- pm_users (roster)
CREATE POLICY "Approved users can read roster"
  ON public.pm_users FOR SELECT TO authenticated
  USING (public.is_approved_pm_user() AND is_active = true);

CREATE POLICY "Users can update own pm profile"
  ON public.pm_users FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "PMs can manage roster"
  ON public.pm_users FOR ALL TO authenticated
  USING (public.has_pm_role(ARRAY['pm','ba']))
  WITH CHECK (public.has_pm_role(ARRAY['pm','ba']));

-- Generic shared-table policy factory via DO block
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','pm_projects','pm_project_members','pm_project_phases',
    'pm_tasks','pm_task_dependencies','pm_subtasks','pm_checklist_items',
    'pm_attachments','pm_comments','pm_activity_log','pm_forms','pm_form_fields',
    'pm_form_submissions','pm_webhooks','pm_webhook_deliveries','pm_client_environments',
    'pm_project_templates','pm_template_tasks','pm_template_dependencies',
    'pm_design_rounds','pm_dev_status_log','pm_project_attachments','pm_task_links',
    'pm_snippet_categories','pm_snippets','pm_snippet_variations','pm_task_snippets',
    'pm_template_task_snippets','pm_template_page_groups','pm_template_page_presets',
    'pm_notes','pm_project_links','pm_task_assignees','pm_client_watchers',
    'pm_snippet_incidents','pm_activities','pm_tag_catalog','pm_task_watchers',
    'pm_portal_access','pm_portal_messages','pm_client_notes','pm_client_assets'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_approved_pm_user())',
      t || '_select_approved', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_approved_pm_user())',
      t || '_insert_approved', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_approved_pm_user()) WITH CHECK (public.is_approved_pm_user())',
      t || '_update_approved', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_approved_pm_user())',
      t || '_delete_approved', t
    );
  END LOOP;
END $$;

-- Personal / self-scoped tables
CREATE POLICY "Own time entries select"
  ON public.pm_time_entries FOR SELECT TO authenticated
  USING (
    user_id = public.current_pm_user_id()
    OR public.has_pm_role(ARRAY['pm','ba'])
  );
CREATE POLICY "Own time entries insert"
  ON public.pm_time_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_pm_user_id());
CREATE POLICY "Own time entries update"
  ON public.pm_time_entries FOR UPDATE TO authenticated
  USING (user_id = public.current_pm_user_id() OR public.has_pm_role(ARRAY['pm','ba']))
  WITH CHECK (user_id = public.current_pm_user_id() OR public.has_pm_role(ARRAY['pm','ba']));
CREATE POLICY "Own time entries delete"
  ON public.pm_time_entries FOR DELETE TO authenticated
  USING (user_id = public.current_pm_user_id() OR public.has_pm_role(ARRAY['pm','ba']));

CREATE POLICY "Own notifications select"
  ON public.pm_notifications FOR SELECT TO authenticated
  USING (user_id = public.current_pm_user_id());
CREATE POLICY "Own notifications insert"
  ON public.pm_notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_pm_user());
CREATE POLICY "Own notifications update"
  ON public.pm_notifications FOR UPDATE TO authenticated
  USING (user_id = public.current_pm_user_id())
  WITH CHECK (user_id = public.current_pm_user_id());
CREATE POLICY "Own notifications delete"
  ON public.pm_notifications FOR DELETE TO authenticated
  USING (user_id = public.current_pm_user_id());

CREATE POLICY "Own notification prefs all"
  ON public.pm_notification_prefs FOR ALL TO authenticated
  USING (user_id = public.current_pm_user_id())
  WITH CHECK (user_id = public.current_pm_user_id());

CREATE POLICY "Own pinned tasks all"
  ON public.pm_user_pinned_tasks FOR ALL TO authenticated
  USING (user_id = public.current_pm_user_id())
  WITH CHECK (user_id = public.current_pm_user_id());

CREATE POLICY "Own active timers all"
  ON public.pm_active_timers FOR ALL TO authenticated
  USING (user_id = public.current_pm_user_id())
  WITH CHECK (user_id = public.current_pm_user_id());

CREATE POLICY "Own portal notifications select"
  ON public.pm_portal_notifications FOR SELECT TO authenticated
  USING (
    user_id = public.current_pm_user_id()
    OR public.has_pm_role(ARRAY['pm','ba'])
  );
CREATE POLICY "Portal notifications insert approved"
  ON public.pm_portal_notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_pm_user());
CREATE POLICY "Own portal notifications update"
  ON public.pm_portal_notifications FOR UPDATE TO authenticated
  USING (
    user_id = public.current_pm_user_id()
    OR public.has_pm_role(ARRAY['pm','ba'])
  )
  WITH CHECK (
    user_id = public.current_pm_user_id()
    OR public.has_pm_role(ARRAY['pm','ba'])
  );
CREATE POLICY "Portal notifications delete pm"
  ON public.pm_portal_notifications FOR DELETE TO authenticated
  USING (public.has_pm_role(ARRAY['pm','ba']));

-- ---------------------------------------------------------------------------
-- Narrow anon policies for public intake forms
-- ---------------------------------------------------------------------------
CREATE POLICY "Anon can read shareable forms"
  ON public.pm_forms FOR SELECT TO anon
  USING (shareable_slug IS NOT NULL);

CREATE POLICY "Anon can read form fields"
  ON public.pm_form_fields FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.pm_forms f
      WHERE f.id = form_id AND f.shareable_slug IS NOT NULL
    )
  );

CREATE POLICY "Anon can read clients for forms"
  ON public.clients FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon can insert form submissions"
  ON public.pm_form_submissions FOR INSERT TO anon
  WITH CHECK (true);

-- PublicForm currently inserts projects/tasks directly; keep narrow write access
CREATE POLICY "Anon can insert projects from forms"
  ON public.pm_projects FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can select projects for form attach"
  ON public.pm_projects FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon can insert tasks from forms"
  ON public.pm_tasks FOR INSERT TO anon
  WITH CHECK (true);

-- First login: link auth.users -> pm_users by email when not already linked
CREATE OR REPLACE FUNCTION public.claim_pm_user()
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
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO pm_id FROM public.pm_users WHERE auth_user_id = uid AND is_active = true LIMIT 1;
  IF pm_id IS NOT NULL THEN
    RETURN pm_id;
  END IF;

  SELECT lower(email) INTO em FROM auth.users WHERE id = uid;
  IF em IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.pm_users
  SET auth_user_id = uid
  WHERE auth_user_id IS NULL
    AND is_active = true
    AND lower(email) = em
  RETURNING id INTO pm_id;

  RETURN pm_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pm_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_pm_user() TO authenticated;
