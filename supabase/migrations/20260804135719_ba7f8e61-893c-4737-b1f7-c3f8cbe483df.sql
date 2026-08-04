-- 1. pm_portal_access
CREATE TABLE IF NOT EXISTS public.pm_portal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  label text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.mock_users(id),
  is_active boolean NOT NULL DEFAULT true,
  last_accessed_at timestamptz,
  invite_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pm_portal_access_email_idx ON public.pm_portal_access(email);
CREATE INDEX IF NOT EXISTS pm_portal_access_token_idx ON public.pm_portal_access(token);
CREATE INDEX IF NOT EXISTS pm_portal_access_client_idx ON public.pm_portal_access(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_portal_access TO anon, authenticated;
GRANT ALL ON public.pm_portal_access TO service_role;
ALTER TABLE public.pm_portal_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm_portal_access_select" ON public.pm_portal_access FOR SELECT USING (true);
CREATE POLICY "pm_portal_access_insert" ON public.pm_portal_access FOR INSERT WITH CHECK (true);
CREATE POLICY "pm_portal_access_update" ON public.pm_portal_access FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "pm_portal_access_delete" ON public.pm_portal_access FOR DELETE USING (true);

-- 2. pm_portal_messages
CREATE TABLE IF NOT EXISTS public.pm_portal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES public.mock_users(id),
  author_portal_id uuid REFERENCES public.pm_portal_access(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_portal_messages_one_author CHECK (
    (author_user_id IS NOT NULL AND author_portal_id IS NULL)
    OR (author_user_id IS NULL AND author_portal_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS pm_portal_messages_project_idx ON public.pm_portal_messages(project_id);
CREATE INDEX IF NOT EXISTS pm_portal_messages_created_idx ON public.pm_portal_messages(project_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_portal_messages TO anon, authenticated;
GRANT ALL ON public.pm_portal_messages TO service_role;
ALTER TABLE public.pm_portal_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm_portal_messages_select" ON public.pm_portal_messages FOR SELECT USING (true);
CREATE POLICY "pm_portal_messages_insert" ON public.pm_portal_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "pm_portal_messages_update" ON public.pm_portal_messages FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "pm_portal_messages_delete" ON public.pm_portal_messages FOR DELETE USING (true);

CREATE TRIGGER pm_portal_messages_updated_at
BEFORE UPDATE ON public.pm_portal_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. pm_portal_notifications
CREATE TABLE IF NOT EXISTS public.pm_portal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_access_id uuid REFERENCES public.pm_portal_access(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.mock_users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  project_id uuid REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  task_id uuid,
  subject text,
  message text,
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_portal_notifications_kind_check CHECK (
    kind IN ('portal_invite','comment_added','status_changed','file_uploaded','request_completed','update_posted')
  )
);
CREATE INDEX IF NOT EXISTS pm_portal_notifications_access_idx ON public.pm_portal_notifications(portal_access_id);
CREATE INDEX IF NOT EXISTS pm_portal_notifications_user_idx ON public.pm_portal_notifications(user_id);
CREATE INDEX IF NOT EXISTS pm_portal_notifications_project_kind_idx ON public.pm_portal_notifications(project_id, kind, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_portal_notifications TO anon, authenticated;
GRANT ALL ON public.pm_portal_notifications TO service_role;
ALTER TABLE public.pm_portal_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm_portal_notifications_select" ON public.pm_portal_notifications FOR SELECT USING (true);
CREATE POLICY "pm_portal_notifications_insert" ON public.pm_portal_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "pm_portal_notifications_update" ON public.pm_portal_notifications FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "pm_portal_notifications_delete" ON public.pm_portal_notifications FOR DELETE USING (true);

-- 4. Column additions
ALTER TABLE public.pm_comments
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'internal';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pm_comments_visibility_check'
  ) THEN
    ALTER TABLE public.pm_comments
      ADD CONSTRAINT pm_comments_visibility_check CHECK (visibility IN ('internal','client'));
  END IF;
END $$;

ALTER TABLE public.pm_tasks
  ADD COLUMN IF NOT EXISTS needs_client_update boolean NOT NULL DEFAULT false;