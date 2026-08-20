-- Retarget RLS to private.* helpers; keep only claim_pm_user as a public RPC
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
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

CREATE POLICY "Approved users can read roster"
  ON public.pm_users FOR SELECT TO authenticated
  USING (private.is_approved_pm_user() AND is_active = true);
CREATE POLICY "Users can update own pm profile"
  ON public.pm_users FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "PMs can manage roster"
  ON public.pm_users FOR ALL TO authenticated
  USING (private.has_pm_role(ARRAY['pm','ba']))
  WITH CHECK (private.has_pm_role(ARRAY['pm','ba']));

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
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (private.is_approved_pm_user())', t || '_select_approved', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (private.is_approved_pm_user())', t || '_insert_approved', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (private.is_approved_pm_user()) WITH CHECK (private.is_approved_pm_user())', t || '_update_approved', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (private.is_approved_pm_user())', t || '_delete_approved', t);
  END LOOP;
END $$;

CREATE POLICY "Own time entries select" ON public.pm_time_entries FOR SELECT TO authenticated USING (user_id = private.current_pm_user_id() OR private.has_pm_role(ARRAY['pm','ba']));
CREATE POLICY "Own time entries insert" ON public.pm_time_entries FOR INSERT TO authenticated WITH CHECK (user_id = private.current_pm_user_id());
CREATE POLICY "Own time entries update" ON public.pm_time_entries FOR UPDATE TO authenticated USING (user_id = private.current_pm_user_id() OR private.has_pm_role(ARRAY['pm','ba'])) WITH CHECK (user_id = private.current_pm_user_id() OR private.has_pm_role(ARRAY['pm','ba']));
CREATE POLICY "Own time entries delete" ON public.pm_time_entries FOR DELETE TO authenticated USING (user_id = private.current_pm_user_id() OR private.has_pm_role(ARRAY['pm','ba']));

CREATE POLICY "Own notifications select" ON public.pm_notifications FOR SELECT TO authenticated USING (user_id = private.current_pm_user_id());
CREATE POLICY "Own notifications insert" ON public.pm_notifications FOR INSERT TO authenticated WITH CHECK (private.is_approved_pm_user());
CREATE POLICY "Own notifications update" ON public.pm_notifications FOR UPDATE TO authenticated USING (user_id = private.current_pm_user_id()) WITH CHECK (user_id = private.current_pm_user_id());
CREATE POLICY "Own notifications delete" ON public.pm_notifications FOR DELETE TO authenticated USING (user_id = private.current_pm_user_id());

CREATE POLICY "Own notification prefs all" ON public.pm_notification_prefs FOR ALL TO authenticated USING (user_id = private.current_pm_user_id()) WITH CHECK (user_id = private.current_pm_user_id());
CREATE POLICY "Own pinned tasks all" ON public.pm_user_pinned_tasks FOR ALL TO authenticated USING (user_id = private.current_pm_user_id()) WITH CHECK (user_id = private.current_pm_user_id());
CREATE POLICY "Own active timers all" ON public.pm_active_timers FOR ALL TO authenticated USING (user_id = private.current_pm_user_id()) WITH CHECK (user_id = private.current_pm_user_id());

CREATE POLICY "Own portal notifications select" ON public.pm_portal_notifications FOR SELECT TO authenticated USING (user_id = private.current_pm_user_id() OR private.has_pm_role(ARRAY['pm','ba']));
CREATE POLICY "Portal notifications insert approved" ON public.pm_portal_notifications FOR INSERT TO authenticated WITH CHECK (private.is_approved_pm_user());
CREATE POLICY "Own portal notifications update" ON public.pm_portal_notifications FOR UPDATE TO authenticated USING (user_id = private.current_pm_user_id() OR private.has_pm_role(ARRAY['pm','ba'])) WITH CHECK (user_id = private.current_pm_user_id() OR private.has_pm_role(ARRAY['pm','ba']));
CREATE POLICY "Portal notifications delete pm" ON public.pm_portal_notifications FOR DELETE TO authenticated USING (private.has_pm_role(ARRAY['pm','ba']));

CREATE POLICY "Anon can read shareable forms" ON public.pm_forms FOR SELECT TO anon USING (shareable_slug IS NOT NULL);
CREATE POLICY "Anon can read form fields" ON public.pm_form_fields FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.pm_forms f WHERE f.id = form_id AND f.shareable_slug IS NOT NULL));
CREATE POLICY "Anon can read clients for forms" ON public.clients FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert form submissions" ON public.pm_form_submissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can insert projects from forms" ON public.pm_projects FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can select projects for form attach" ON public.pm_projects FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert tasks from forms" ON public.pm_tasks FOR INSERT TO anon WITH CHECK (true);

DROP FUNCTION IF EXISTS public.current_pm_user_id();
DROP FUNCTION IF EXISTS public.current_pm_roles();
DROP FUNCTION IF EXISTS public.has_pm_role(text[]);
DROP FUNCTION IF EXISTS public.is_approved_pm_user();

CREATE OR REPLACE FUNCTION public.claim_pm_user()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private
AS $$ SELECT private.claim_pm_user(); $$;
REVOKE ALL ON FUNCTION public.claim_pm_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_pm_user() TO authenticated;
