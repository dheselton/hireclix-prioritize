-- Public intake writes go through the public-form-api Edge Function (service role).
-- Drop broad anon table grants that leaked the client roster / allowed spam inserts.

DROP POLICY IF EXISTS "Anon can read shareable forms" ON public.pm_forms;
DROP POLICY IF EXISTS "Anon can read form fields" ON public.pm_form_fields;
DROP POLICY IF EXISTS "Anon can read clients for forms" ON public.clients;
DROP POLICY IF EXISTS "Anon can insert form submissions" ON public.pm_form_submissions;
DROP POLICY IF EXISTS "Anon can insert projects from forms" ON public.pm_projects;
DROP POLICY IF EXISTS "Anon can select projects for form attach" ON public.pm_projects;
DROP POLICY IF EXISTS "Anon can insert tasks from forms" ON public.pm_tasks;

CREATE TABLE IF NOT EXISTS public.public_form_rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hit_count int NOT NULL DEFAULT 1
);

ALTER TABLE public.public_form_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_form_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.public_form_rate_limits TO postgres, service_role;
