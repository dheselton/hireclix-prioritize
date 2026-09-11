-- Shared client work is discoverable to every approved staff member.
-- Personal work is visible only to its owner and explicitly added project members.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS parent_client_id uuid NULL
    REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_parent_not_self;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_parent_not_self
  CHECK (parent_client_id IS NULL OR parent_client_id <> id);

CREATE INDEX IF NOT EXISTS idx_clients_parent_client_id
  ON public.clients(parent_client_id)
  WHERE parent_client_id IS NOT NULL;

-- Similar names are suggestions, not an instruction to merge distinct brands.
DROP INDEX IF EXISTS public.clients_name_stem_unique;

CREATE TABLE IF NOT EXISTS public.pm_client_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  alias text NOT NULL,
  alias_key text GENERATED ALWAYS AS (
    lower(regexp_replace(trim(alias), '\s+', ' ', 'g'))
  ) STORED,
  created_by uuid NULL REFERENCES public.pm_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(alias_key)
);

CREATE INDEX IF NOT EXISTS idx_pm_client_aliases_client
  ON public.pm_client_aliases(client_id);
ALTER TABLE public.pm_client_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users read client aliases"
  ON public.pm_client_aliases FOR SELECT TO authenticated
  USING ((SELECT private.is_approved_pm_user()));
CREATE POLICY "Operators manage client aliases"
  ON public.pm_client_aliases FOR ALL TO authenticated
  USING ((SELECT private.is_pm_operator()))
  WITH CHECK ((SELECT private.is_pm_operator()));

ALTER TABLE public.pm_projects
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'internal_shared';

ALTER TABLE public.pm_projects
  DROP CONSTRAINT IF EXISTS pm_projects_visibility_check;
ALTER TABLE public.pm_projects
  ADD CONSTRAINT pm_projects_visibility_check
  CHECK (visibility IN ('client_shared', 'internal_shared', 'personal_private'));

-- Existing work remains shared. External client work is client-scoped; internal
-- and clientless work stays internal rather than unexpectedly becoming private.
UPDATE public.pm_projects p
SET visibility = CASE
  WHEN c.id IS NOT NULL AND NOT COALESCE(c.is_internal, false) THEN 'client_shared'
  ELSE 'internal_shared'
END
FROM public.clients c
WHERE p.client_id = c.id;

UPDATE public.pm_projects
SET visibility = 'internal_shared'
WHERE client_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_pm_projects_visibility
  ON public.pm_projects(visibility);
CREATE INDEX IF NOT EXISTS idx_pm_projects_client_visibility_status
  ON public.pm_projects(client_id, visibility, status);
CREATE INDEX IF NOT EXISTS idx_pm_project_members_user_project
  ON public.pm_project_members(user_id, project_id);

-- Remove the contradictory legacy defaults and make raw inserts fail safe.
ALTER TABLE public.pm_projects ALTER COLUMN type DROP DEFAULT;
ALTER TABLE public.pm_projects ALTER COLUMN work_type SET DEFAULT 'project';

UPDATE public.pm_projects
SET type = 'quick_request'
WHERE work_type = 'request' AND type <> 'quick_request';

-- Inverse mismatch (e.g. probe/test rows): keep quick_request typed as requests.
UPDATE public.pm_projects
SET work_type = 'request'
WHERE type = 'quick_request' AND work_type <> 'request';

ALTER TABLE public.pm_projects
  DROP CONSTRAINT IF EXISTS pm_projects_work_type_type_consistent;
ALTER TABLE public.pm_projects
  ADD CONSTRAINT pm_projects_work_type_type_consistent
  CHECK (
    (work_type = 'request' AND type = 'quick_request')
    OR (work_type = 'project' AND type <> 'quick_request')
  );

CREATE OR REPLACE FUNCTION private.can_create_pm_work()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT COALESCE(
    private.is_pm_operator()
    OR private.current_pm_roles() && ARRAY[
      'designer','developer','strategist','analyst','qa','csm','support','tech_lead'
    ]::text[],
    false
  );
$$;

CREATE OR REPLACE FUNCTION private.can_access_pm_project(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT COALESCE(
    private.is_approved_pm_user()
    AND EXISTS (
      SELECT 1
      FROM public.pm_projects p
      WHERE p.id = target_project_id
        AND (
          p.visibility <> 'personal_private'
          OR p.created_by = private.current_pm_user_id()
          OR EXISTS (
            SELECT 1
            FROM public.pm_project_members m
            WHERE m.project_id = p.id
              AND m.user_id = private.current_pm_user_id()
          )
        )
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION private.can_manage_pm_project(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT COALESCE(
    private.is_pm_operator()
    OR EXISTS (
      SELECT 1 FROM public.pm_projects p
      WHERE p.id = target_project_id
        AND p.visibility = 'personal_private'
        AND p.created_by = private.current_pm_user_id()
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION private.can_access_pm_task(target_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pm_tasks t
    WHERE t.id = target_task_id
      AND private.can_access_pm_project(t.project_id)
  );
$$;

CREATE OR REPLACE FUNCTION private.can_update_pm_task(target_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT COALESCE(
    private.is_pm_operator()
    OR EXISTS (
      SELECT 1
      FROM public.pm_tasks t
      WHERE t.id = target_task_id
        AND private.can_access_pm_project(t.project_id)
        AND (
          t.assignee_id = private.current_pm_user_id()
          OR t.created_by = private.current_pm_user_id()
          OR t.status = 'unclaimed'
          OR EXISTS (
            SELECT 1 FROM public.pm_task_assignees a
            WHERE a.task_id = t.id
              AND a.user_id = private.current_pm_user_id()
          )
        )
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION private.can_create_pm_work() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_pm_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_manage_pm_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_pm_task(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_update_pm_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_create_pm_work() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_pm_project(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_manage_pm_project(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_pm_task(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_update_pm_task(uuid) TO authenticated, service_role;

-- Core project policies.
DROP POLICY IF EXISTS pm_projects_select_approved ON public.pm_projects;
DROP POLICY IF EXISTS pm_projects_insert_approved ON public.pm_projects;
DROP POLICY IF EXISTS pm_projects_update_approved ON public.pm_projects;
DROP POLICY IF EXISTS pm_projects_delete_approved ON public.pm_projects;
DROP POLICY IF EXISTS "Anon can insert projects from forms" ON public.pm_projects;
DROP POLICY IF EXISTS "Anon can select projects for form attach" ON public.pm_projects;

CREATE POLICY "Visible projects select"
  ON public.pm_projects FOR SELECT TO authenticated
  USING ((SELECT private.can_access_pm_project(id)));
CREATE POLICY "Authorized project create"
  ON public.pm_projects FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.can_create_pm_work())
    AND (
      visibility <> 'personal_private'
      OR created_by = (SELECT private.current_pm_user_id())
    )
  );
CREATE POLICY "Managers update projects"
  ON public.pm_projects FOR UPDATE TO authenticated
  USING ((SELECT private.can_manage_pm_project(id)))
  WITH CHECK ((SELECT private.can_manage_pm_project(id)));
CREATE POLICY "Managers delete projects"
  ON public.pm_projects FOR DELETE TO authenticated
  USING ((SELECT private.can_manage_pm_project(id)));

-- Membership cannot be used to invite oneself into somebody else's private work.
DROP POLICY IF EXISTS pm_project_members_select_approved ON public.pm_project_members;
DROP POLICY IF EXISTS pm_project_members_insert_approved ON public.pm_project_members;
DROP POLICY IF EXISTS pm_project_members_update_approved ON public.pm_project_members;
DROP POLICY IF EXISTS pm_project_members_delete_approved ON public.pm_project_members;
CREATE POLICY "Visible project members select"
  ON public.pm_project_members FOR SELECT TO authenticated
  USING ((SELECT private.can_access_pm_project(project_id)));
CREATE POLICY "Managers insert project members"
  ON public.pm_project_members FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.can_manage_pm_project(project_id))
    OR EXISTS (
      SELECT 1 FROM public.pm_projects p
      WHERE p.id = project_id
        AND p.created_by = (SELECT private.current_pm_user_id())
        AND (
          user_id = (SELECT private.current_pm_user_id())
          OR user_id = p.requested_by
        )
    )
  );
CREATE POLICY "Managers update project members"
  ON public.pm_project_members FOR UPDATE TO authenticated
  USING ((SELECT private.can_manage_pm_project(project_id)))
  WITH CHECK ((SELECT private.can_manage_pm_project(project_id)));
CREATE POLICY "Managers delete project members"
  ON public.pm_project_members FOR DELETE TO authenticated
  USING ((SELECT private.can_manage_pm_project(project_id)));

-- Tasks inherit their project's visibility.
DROP POLICY IF EXISTS pm_tasks_select_approved ON public.pm_tasks;
DROP POLICY IF EXISTS pm_tasks_insert_approved ON public.pm_tasks;
DROP POLICY IF EXISTS pm_tasks_update_approved ON public.pm_tasks;
DROP POLICY IF EXISTS pm_tasks_delete_approved ON public.pm_tasks;
DROP POLICY IF EXISTS "Anon can insert tasks from forms" ON public.pm_tasks;
CREATE POLICY "Visible project tasks select"
  ON public.pm_tasks FOR SELECT TO authenticated
  USING ((SELECT private.can_access_pm_project(project_id)));
CREATE POLICY "Authorized task create"
  ON public.pm_tasks FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.can_create_pm_work())
    AND (SELECT private.can_access_pm_project(project_id))
  );
CREATE POLICY "Contributors update assigned tasks"
  ON public.pm_tasks FOR UPDATE TO authenticated
  USING ((SELECT private.can_update_pm_task(id)))
  WITH CHECK ((SELECT private.can_access_pm_project(project_id)));
CREATE POLICY "Managers delete tasks"
  ON public.pm_tasks FOR DELETE TO authenticated
  USING ((SELECT private.can_manage_pm_project(project_id)));

-- Read policies for rows whose project can otherwise be inferred by id.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pm_project_phases','pm_project_attachments','pm_project_links',
    'pm_portal_messages'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_approved', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT private.can_access_pm_project(project_id)))',
      t || '_select_visible_project', t
    );
  END LOOP;
END $$;

-- Rows that can point at either a project or task.
DROP POLICY IF EXISTS pm_attachments_select_approved ON public.pm_attachments;
CREATE POLICY "Visible attachments select"
  ON public.pm_attachments FOR SELECT TO authenticated
  USING (
    (project_id IS NOT NULL AND (SELECT private.can_access_pm_project(project_id)))
    OR (task_id IS NOT NULL AND (SELECT private.can_access_pm_task(task_id)))
  );

DROP POLICY IF EXISTS pm_comments_select_approved ON public.pm_comments;
CREATE POLICY "Visible comments select"
  ON public.pm_comments FOR SELECT TO authenticated
  USING (
    (project_id IS NOT NULL AND (SELECT private.can_access_pm_project(project_id)))
    OR (task_id IS NOT NULL AND (SELECT private.can_access_pm_task(task_id)))
  );

DROP POLICY IF EXISTS pm_activity_log_select_approved ON public.pm_activity_log;
CREATE POLICY "Visible activity select"
  ON public.pm_activity_log FOR SELECT TO authenticated
  USING (
    (project_id IS NOT NULL AND (SELECT private.can_access_pm_project(project_id)))
    OR (task_id IS NOT NULL AND (SELECT private.can_access_pm_task(task_id)))
  );

-- Public intake is handled by the service-role Edge Function. Direct anonymous
-- project/task reads and writes are intentionally removed above.

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
  IF project_visibility IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  INSERT INTO public.pm_projects (
    title, client_id, parent_project_id, type, work_type, status,
    visibility, description, start_date, go_live_date, created_by,
    requested_by, custom_fields, creation_source, creation_context
  ) VALUES (
    trim(p_title), p_client_id, p_parent_project_id, 'quick_request', 'request',
    'active', project_visibility, NULLIF(trim(p_description), ''), current_date,
    p_due_date, actor_id, COALESCE(p_requested_by, actor_id),
    jsonb_build_object('request_type', p_request_type) || COALESCE(p_custom_fields, '{}'::jsonb),
    p_creation_source, jsonb_build_object('request_type', p_request_type)
      || COALESCE(p_creation_context, '{}'::jsonb)
  )
  RETURNING id INTO project_id;

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
  )
  INTO clean_titles
  FROM unnest(p_task_titles[1:3]) AS v;

  FOREACH task_title IN ARRAY clean_titles LOOP
    INSERT INTO public.pm_tasks (
      project_id, title, description, type, status, priority, duration_days,
      created_by, assignee_id, due_date, creation_source, creation_context
    ) VALUES (
      project_id, task_title, NULLIF(trim(p_description), ''), p_task_type,
      'unclaimed', 'medium', 1, actor_id, NULL, p_due_date,
      p_creation_source, jsonb_build_object('request_type', p_request_type)
        || COALESCE(p_creation_context, '{}'::jsonb)
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
