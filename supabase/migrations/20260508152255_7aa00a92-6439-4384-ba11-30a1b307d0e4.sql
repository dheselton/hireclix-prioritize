
-- ============ PM PLATFORM SCHEMA ============

CREATE TABLE public.mock_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('pm','designer','developer','submitter')),
  email text,
  avatar_url text,
  capacity_hours_per_week integer DEFAULT 40,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pm_project_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  description text,
  default_go_live_offset_days integer DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pm_template_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.pm_project_templates(id) ON DELETE CASCADE,
  temp_id text NOT NULL,
  title text NOT NULL,
  type text NOT NULL,
  role text,
  duration_days integer NOT NULL DEFAULT 1,
  assignee_role text,
  phase_name text,
  sort_order integer NOT NULL DEFAULT 0,
  checklist_items jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE public.pm_template_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.pm_project_templates(id) ON DELETE CASCADE,
  from_temp_id text NOT NULL,
  to_temp_id text NOT NULL,
  type text NOT NULL DEFAULT 'finish_start' CHECK (type IN ('finish_start','start_start','finish_finish')),
  lag_days integer DEFAULT 0
);

CREATE TABLE public.pm_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'quick_request',
  status text NOT NULL DEFAULT 'active',
  go_live_date date,
  start_date date,
  description text,
  tags text[] DEFAULT '{}',
  template_id uuid REFERENCES public.pm_project_templates(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.mock_users(id) ON DELETE SET NULL,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pm_project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.mock_users(id) ON DELETE CASCADE,
  role text NOT NULL,
  UNIQUE (project_id, user_id)
);

CREATE TABLE public.pm_project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.pm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.pm_project_phases(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'design',
  status text NOT NULL DEFAULT 'unclaimed',
  assignee_id uuid REFERENCES public.mock_users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.mock_users(id) ON DELETE SET NULL,
  start_date date,
  due_date date,
  duration_days integer NOT NULL DEFAULT 1,
  priority text NOT NULL DEFAULT 'medium',
  tags text[] DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  -- design-specific
  design_round integer DEFAULT 1,
  design_approval text,
  -- dev-specific
  dev_blocker text,
  dev_status_log jsonb DEFAULT '[]'::jsonb,
  dev_links jsonb DEFAULT '[]'::jsonb,
  dev_environment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pm_task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'finish_start' CHECK (type IN ('finish_start','start_start','finish_finish')),
  lag_days integer DEFAULT 0,
  UNIQUE (task_id, depends_on_task_id)
);

CREATE TABLE public.pm_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  complete boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.pm_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  label text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.pm_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.mock_users(id) ON DELETE CASCADE,
  minutes integer NOT NULL,
  note text,
  logged_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pm_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  url text NOT NULL,
  name text NOT NULL,
  uploaded_by uuid REFERENCES public.mock_users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pm_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.mock_users(id) ON DELETE SET NULL,
  body text NOT NULL,
  mentions uuid[] DEFAULT '{}',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pm_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.mock_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pm_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.mock_users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pm_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  submit_action jsonb DEFAULT '{"creates":"task"}'::jsonb,
  webhook_url text,
  auth_token text,
  shareable_slug text UNIQUE,
  notify_emails text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pm_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.pm_forms(id) ON DELETE CASCADE,
  label text NOT NULL,
  type text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  placeholder text,
  options jsonb DEFAULT '[]'::jsonb,
  conditionals jsonb DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.pm_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.pm_forms(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_project_id uuid REFERENCES public.pm_projects(id) ON DELETE SET NULL,
  created_task_id uuid REFERENCES public.pm_tasks(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'received',
  submitter_name text,
  submitter_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pm_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  headers jsonb DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  secret text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pm_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.pm_webhooks(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb,
  response_status integer,
  response_body text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pm_client_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  prod_endpoint text,
  staging_endpoint text,
  contacts jsonb DEFAULT '[]'::jsonb,
  notes text,
  integrations jsonb DEFAULT '[]'::jsonb
);

-- Triggers for updated_at on tasks/projects
CREATE TRIGGER pm_projects_updated_at BEFORE UPDATE ON public.pm_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pm_tasks_updated_at BEFORE UPDATE ON public.pm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS + permissive policies (auth is disabled in dev)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'mock_users','clients','pm_projects','pm_project_members','pm_project_phases',
    'pm_tasks','pm_task_dependencies','pm_subtasks','pm_checklist_items',
    'pm_time_entries','pm_attachments','pm_comments','pm_activity_log',
    'pm_notifications','pm_forms','pm_form_fields','pm_form_submissions',
    'pm_webhooks','pm_webhook_deliveries','pm_client_environments',
    'pm_project_templates','pm_template_tasks','pm_template_dependencies'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY "public read" ON public.%I FOR SELECT USING (true);', t);
    EXECUTE format('CREATE POLICY "public insert" ON public.%I FOR INSERT WITH CHECK (true);', t);
    EXECUTE format('CREATE POLICY "public update" ON public.%I FOR UPDATE USING (true);', t);
    EXECUTE format('CREATE POLICY "public delete" ON public.%I FOR DELETE USING (true);', t);
  END LOOP;
END $$;

-- Seed mock users
INSERT INTO public.mock_users (name, role, email, capacity_hours_per_week) VALUES
  ('Alex Morgan', 'pm', 'alex@agency.test', 40),
  ('Sam Rivera', 'designer', 'sam@agency.test', 40),
  ('Jordan Lee', 'developer', 'jordan@agency.test', 40),
  ('Taylor Kim', 'submitter', 'taylor@client.test', 0);

-- Seed clients
INSERT INTO public.clients (name) VALUES ('Acme Corp'), ('Globex Inc');
