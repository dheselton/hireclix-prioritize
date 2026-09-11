-- Safe, additive follow-up for 20260911184942. Keep the original migration
-- immutable because it may already be recorded in supabase_migrations.

-- Generated columns are only available after BEFORE triggers have run.
CREATE OR REPLACE FUNCTION private.prevent_pm_client_alias_collision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.clients c
    WHERE public.pm_client_name_key(c.name) = NEW.alias_key
      AND c.id <> NEW.client_id
  ) THEN
    RAISE EXCEPTION 'Alias is already a canonical client name' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.prevent_pm_client_name_alias_collision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.pm_client_aliases a
    WHERE a.alias_key = public.pm_client_name_key(NEW.name)
      AND a.client_id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'Client name is already an alias for another client' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_pm_client_alias_collision ON public.pm_client_aliases;
CREATE TRIGGER prevent_pm_client_alias_collision
  AFTER INSERT OR UPDATE OF alias, client_id ON public.pm_client_aliases
  FOR EACH ROW EXECUTE FUNCTION private.prevent_pm_client_alias_collision();
DROP TRIGGER IF EXISTS prevent_pm_client_name_alias_collision ON public.clients;
CREATE TRIGGER prevent_pm_client_name_alias_collision
  BEFORE INSERT OR UPDATE OF name ON public.clients
  FOR EACH ROW EXECUTE FUNCTION private.prevent_pm_client_name_alias_collision();
REVOKE ALL ON FUNCTION private.prevent_pm_client_alias_collision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_pm_client_name_alias_collision() FROM PUBLIC, anon, authenticated;

INSERT INTO public.pm_client_aliases(client_id, alias)
SELECT c.id, known.alias
FROM (VALUES
  ('parsons', 'Parsons Careers'),
  ('resideo', 'Resideo Careers'),
  ('mobility global', 'Mobility Global Careers'),
  ('penfed', 'Penfed Careers')
) AS known(client_key, alias)
JOIN public.clients c ON public.pm_client_name_key(c.name) = known.client_key
ON CONFLICT (alias_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.pm_lookup_client_identity(query_name text)
RETURNS TABLE(client_id uuid, client_name text, match_kind text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT match.client_id, match.client_name, match.match_kind
  FROM (
    SELECT c.id AS client_id, c.name AS client_name, 'name'::text AS match_kind, 0 AS priority
    FROM public.clients c
    WHERE public.pm_client_name_key(c.name) = public.pm_client_name_key(query_name)
    UNION ALL
    SELECT c.id, c.name, 'alias'::text, 1
    FROM public.pm_client_aliases a
    JOIN public.clients c ON c.id = a.client_id
    WHERE a.alias_key = public.pm_client_name_key(query_name)
  ) AS match
  ORDER BY match.priority
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.pm_lookup_client_identity(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pm_lookup_client_identity(text) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_merge_client(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_merge_client(uuid, uuid) TO service_role, postgres;

DROP POLICY IF EXISTS clients_insert_approved ON public.clients;
DROP POLICY IF EXISTS clients_update_approved ON public.clients;
DROP POLICY IF EXISTS clients_delete_approved ON public.clients;
CREATE POLICY "Operators insert clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_pm_operator()));
CREATE POLICY "Operators update clients" ON public.clients FOR UPDATE TO authenticated
  USING ((SELECT private.is_pm_operator()))
  WITH CHECK ((SELECT private.is_pm_operator()));
CREATE POLICY "Operators delete clients" ON public.clients FOR DELETE TO authenticated
  USING ((SELECT private.is_pm_operator()));

ALTER TABLE public.pm_projects ALTER COLUMN visibility SET DEFAULT 'personal_private';
CREATE OR REPLACE FUNCTION private.default_pm_project_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.client_id IS NULL THEN
    NEW.visibility := COALESCE(NEW.visibility, 'personal_private');
  ELSIF NEW.visibility IS NULL OR NEW.visibility = 'personal_private' THEN
    SELECT CASE WHEN COALESCE(c.is_internal, false)
      THEN 'internal_shared' ELSE 'client_shared' END
    INTO NEW.visibility
    FROM public.clients c
    WHERE c.id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS default_pm_project_visibility ON public.pm_projects;
CREATE TRIGGER default_pm_project_visibility
  BEFORE INSERT OR UPDATE OF client_id ON public.pm_projects
  FOR EACH ROW EXECUTE FUNCTION private.default_pm_project_visibility();
REVOKE ALL ON FUNCTION private.default_pm_project_visibility() FROM PUBLIC, anon, authenticated;

-- The first migration accepted text for creation_source; explicitly cast it to
-- the enum so all supported PostgreSQL versions execute the RPC consistently.
CREATE OR REPLACE FUNCTION public.create_quick_request(
  p_title text,
  p_client_id uuid,
  p_request_type text,
  p_description text DEFAULT NULL,
  p_custom_fields jsonb DEFAULT '{}'::jsonb,
  p_requested_by uuid DEFAULT NULL,
  p_task_titles text[] DEFAULT ARRAY[]::text[],
  p_task_type text DEFAULT 'design',
  p_due_date date DEFAULT NULL,
  p_parent_project_id uuid DEFAULT NULL,
  p_creation_source text DEFAULT 'intake',
  p_creation_context jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  actor_id uuid := private.current_pm_user_id();
  project_id uuid;
  task_title text;
  clean_titles text[];
  project_visibility text;
BEGIN
  IF NOT private.can_create_pm_work() THEN
    RAISE EXCEPTION 'Not authorized to create work';
  END IF;
  IF NULLIF(trim(p_title), '') IS NULL OR p_client_id IS NULL THEN
    RAISE EXCEPTION 'Title and client are required';
  END IF;

  SELECT CASE WHEN COALESCE(is_internal, false)
    THEN 'internal_shared' ELSE 'client_shared' END
  INTO project_visibility
  FROM public.clients
  WHERE id = p_client_id;
  IF project_visibility IS NULL THEN RAISE EXCEPTION 'Client not found'; END IF;

  INSERT INTO public.pm_projects (
    title, client_id, parent_project_id, type, work_type, status,
    visibility, description, start_date, go_live_date, created_by,
    requested_by, custom_fields, creation_source, creation_context
  ) VALUES (
    trim(p_title), p_client_id, p_parent_project_id, 'quick_request', 'request',
    'active', project_visibility, NULLIF(trim(p_description), ''), current_date,
    p_due_date, actor_id, COALESCE(p_requested_by, actor_id),
    jsonb_build_object('request_type', p_request_type) || COALESCE(p_custom_fields, '{}'::jsonb),
    p_creation_source::public.pm_creation_source,
    jsonb_build_object('request_type', p_request_type) || COALESCE(p_creation_context, '{}'::jsonb)
  ) RETURNING id INTO project_id;

  INSERT INTO public.pm_project_members(project_id, user_id, role)
  VALUES (project_id, actor_id, 'creator')
  ON CONFLICT (project_id, user_id) DO NOTHING;
  IF p_requested_by IS NOT NULL AND p_requested_by <> actor_id THEN
    INSERT INTO public.pm_project_members(project_id, user_id, role)
    VALUES (project_id, p_requested_by, 'requester')
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;

  SELECT COALESCE(
    array_agg(trim(v)) FILTER (WHERE NULLIF(trim(v), '') IS NOT NULL),
    ARRAY[trim(p_title)]::text[]
  ) INTO clean_titles
  FROM unnest(p_task_titles[1:3]) AS v;

  FOREACH task_title IN ARRAY clean_titles LOOP
    INSERT INTO public.pm_tasks (
      project_id, title, description, type, status, priority, duration_days,
      created_by, assignee_id, due_date, creation_source, creation_context
    ) VALUES (
      project_id, task_title, NULLIF(trim(p_description), ''), p_task_type,
      'unclaimed', 'medium', 1, actor_id, NULL, p_due_date,
      p_creation_source::public.pm_creation_source,
      jsonb_build_object('request_type', p_request_type) || COALESCE(p_creation_context, '{}'::jsonb)
    );
  END LOOP;
  RETURN project_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_quick_request(
  text,uuid,text,text,jsonb,uuid,text[],text,date,uuid,text,jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_quick_request(
  text,uuid,text,text,jsonb,uuid,text[],text,date,uuid,text,jsonb
) TO authenticated;

-- Retarget both reads and writes for direct project-scoped children.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pm_project_phases','pm_project_attachments','pm_project_links','pm_portal_messages'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_approved', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_approved', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_approved', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_approved', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_visible_project', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_visible_project', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_visible_project', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_visible_project', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT private.can_access_pm_project(project_id)))', t || '_select_visible_project', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT private.can_access_pm_project(project_id)))', t || '_insert_visible_project', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT private.can_access_pm_project(project_id))) WITH CHECK ((SELECT private.can_access_pm_project(project_id)))', t || '_update_visible_project', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT private.can_access_pm_project(project_id)))', t || '_delete_visible_project', t);
  END LOOP;
END $$;

-- Task-scoped children inherit task visibility. Open policies from later
-- migrations are removed explicitly below.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pm_subtasks','pm_checklist_items','pm_task_links','pm_task_watchers',
    'pm_task_snippets','pm_design_rounds','pm_dev_status_log','pm_vendor_escalation_tasks'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_approved', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_approved', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_approved', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_approved', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_visible_task', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_visible_task', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_visible_task', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_visible_task', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT private.can_access_pm_task(task_id)))', t || '_select_visible_task', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT private.can_access_pm_task(task_id)))', t || '_insert_visible_task', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT private.can_access_pm_task(task_id))) WITH CHECK ((SELECT private.can_access_pm_task(task_id)))', t || '_update_visible_task', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT private.can_access_pm_task(task_id)))', t || '_delete_visible_task', t);
  END LOOP;
END $$;

DO $$
DECLARE t text;
DECLARE predicate text := '((project_id IS NOT NULL AND (SELECT private.can_access_pm_project(project_id))) OR (task_id IS NOT NULL AND (SELECT private.can_access_pm_task(task_id))))';
BEGIN
  FOREACH t IN ARRAY ARRAY['pm_attachments','pm_comments','pm_activity_log']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_approved', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_approved', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_approved', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_approved', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Visible ' || t || ' select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)', t || '_select_visible_work', t, predicate);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', t || '_insert_visible_work', t, predicate);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', t || '_update_visible_work', t, predicate, predicate);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)', t || '_delete_visible_work', t, predicate);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "public read" ON public.pm_vendor_escalation_tasks;
DROP POLICY IF EXISTS "public insert" ON public.pm_vendor_escalation_tasks;
DROP POLICY IF EXISTS "public update" ON public.pm_vendor_escalation_tasks;
DROP POLICY IF EXISTS "public delete" ON public.pm_vendor_escalation_tasks;

DROP POLICY IF EXISTS pm_task_dependencies_select_approved ON public.pm_task_dependencies;
DROP POLICY IF EXISTS pm_task_dependencies_insert_approved ON public.pm_task_dependencies;
DROP POLICY IF EXISTS pm_task_dependencies_update_approved ON public.pm_task_dependencies;
DROP POLICY IF EXISTS pm_task_dependencies_delete_approved ON public.pm_task_dependencies;
CREATE POLICY pm_task_dependencies_select_visible_task ON public.pm_task_dependencies
  FOR SELECT TO authenticated USING (
    (SELECT private.can_access_pm_task(task_id))
    AND (SELECT private.can_access_pm_task(depends_on_task_id))
  );
CREATE POLICY pm_task_dependencies_insert_visible_task ON public.pm_task_dependencies
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT private.can_access_pm_task(task_id))
    AND (SELECT private.can_access_pm_task(depends_on_task_id))
  );
CREATE POLICY pm_task_dependencies_update_visible_task ON public.pm_task_dependencies
  FOR UPDATE TO authenticated
  USING (
    (SELECT private.can_access_pm_task(task_id))
    AND (SELECT private.can_access_pm_task(depends_on_task_id))
  )
  WITH CHECK (
    (SELECT private.can_access_pm_task(task_id))
    AND (SELECT private.can_access_pm_task(depends_on_task_id))
  );
CREATE POLICY pm_task_dependencies_delete_visible_task ON public.pm_task_dependencies
  FOR DELETE TO authenticated USING (
    (SELECT private.can_access_pm_task(task_id))
    AND (SELECT private.can_access_pm_task(depends_on_task_id))
  );

DROP POLICY IF EXISTS pm_task_assignees_select_approved ON public.pm_task_assignees;
DROP POLICY IF EXISTS pm_task_assignees_insert_approved ON public.pm_task_assignees;
DROP POLICY IF EXISTS pm_task_assignees_update_approved ON public.pm_task_assignees;
DROP POLICY IF EXISTS pm_task_assignees_delete_approved ON public.pm_task_assignees;
CREATE POLICY "Visible co-assignees select" ON public.pm_task_assignees
  FOR SELECT TO authenticated USING ((SELECT private.can_access_pm_task(task_id)));
CREATE POLICY "Managers or self add co-assignee" ON public.pm_task_assignees
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (SELECT private.current_pm_user_id())
    OR EXISTS (
      SELECT 1 FROM public.pm_tasks t
      WHERE t.id = task_id AND (SELECT private.can_manage_pm_project(t.project_id))
    )
  );
CREATE POLICY "Managers or self remove co-assignee" ON public.pm_task_assignees
  FOR DELETE TO authenticated USING (
    user_id = (SELECT private.current_pm_user_id())
    OR EXISTS (
      SELECT 1 FROM public.pm_tasks t
      WHERE t.id = task_id AND (SELECT private.can_manage_pm_project(t.project_id))
    )
  );

CREATE OR REPLACE FUNCTION private.protect_pm_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
     AND NOT private.can_manage_pm_project(OLD.project_id)
     AND NOT (
       OLD.assignee_id IS NULL
       AND NEW.assignee_id = private.current_pm_user_id()
       AND OLD.status = 'unclaimed'
     )
  THEN
    RAISE EXCEPTION 'Only a client-work manager can reassign this task';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_pm_task_assignment ON public.pm_tasks;
CREATE TRIGGER protect_pm_task_assignment
  BEFORE UPDATE OF assignee_id ON public.pm_tasks
  FOR EACH ROW EXECUTE FUNCTION private.protect_pm_task_assignment();
REVOKE ALL ON FUNCTION private.protect_pm_task_assignment() FROM PUBLIC, anon, authenticated;

-- Keep activity-based time entries/timers available: their task_id is NULL by
-- design and activity_id is the access target.
DROP POLICY IF EXISTS "Own time entries select" ON public.pm_time_entries;
DROP POLICY IF EXISTS "Own time entries insert" ON public.pm_time_entries;
DROP POLICY IF EXISTS "Own time entries update" ON public.pm_time_entries;
DROP POLICY IF EXISTS "Own time entries delete" ON public.pm_time_entries;
DROP POLICY IF EXISTS "Own visible time entries select" ON public.pm_time_entries;
DROP POLICY IF EXISTS "Own visible time entries insert" ON public.pm_time_entries;
DROP POLICY IF EXISTS "Own visible time entries update" ON public.pm_time_entries;
DROP POLICY IF EXISTS "Own visible time entries delete" ON public.pm_time_entries;
CREATE POLICY "Own visible time entries select" ON public.pm_time_entries
  FOR SELECT TO authenticated USING (
    (user_id = (SELECT private.current_pm_user_id()) OR (SELECT private.is_pm_operator()))
    AND (task_id IS NULL OR (SELECT private.can_access_pm_task(task_id)))
  );
CREATE POLICY "Own visible time entries insert" ON public.pm_time_entries
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (SELECT private.current_pm_user_id())
    AND (task_id IS NULL OR (SELECT private.can_access_pm_task(task_id)))
  );
CREATE POLICY "Own visible time entries update" ON public.pm_time_entries
  FOR UPDATE TO authenticated
  USING (
    (user_id = (SELECT private.current_pm_user_id()) OR (SELECT private.is_pm_operator()))
    AND (task_id IS NULL OR (SELECT private.can_access_pm_task(task_id)))
  )
  WITH CHECK (
    (user_id = (SELECT private.current_pm_user_id()) OR (SELECT private.is_pm_operator()))
    AND (task_id IS NULL OR (SELECT private.can_access_pm_task(task_id)))
  );
CREATE POLICY "Own visible time entries delete" ON public.pm_time_entries
  FOR DELETE TO authenticated USING (
    (user_id = (SELECT private.current_pm_user_id()) OR (SELECT private.is_pm_operator()))
    AND (task_id IS NULL OR (SELECT private.can_access_pm_task(task_id)))
  );

DROP POLICY IF EXISTS "Own active timers all" ON public.pm_active_timers;
DROP POLICY IF EXISTS "Own visible active timers" ON public.pm_active_timers;
CREATE POLICY "Own visible active timers" ON public.pm_active_timers
  FOR ALL TO authenticated
  USING (
    user_id = (SELECT private.current_pm_user_id())
    AND (task_id IS NULL OR (SELECT private.can_access_pm_task(task_id)))
  )
  WITH CHECK (
    user_id = (SELECT private.current_pm_user_id())
    AND (task_id IS NULL OR (SELECT private.can_access_pm_task(task_id)))
  );
