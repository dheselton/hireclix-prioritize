-- Per-user subscriptions to quick-request category groups.
-- group_key matches REQUEST_TYPE_GROUPS in src/lib/pm/requestTypes.ts

CREATE TABLE IF NOT EXISTS public.pm_new_request_subs (
  user_id uuid NOT NULL REFERENCES public.pm_users(id) ON DELETE CASCADE,
  group_key text NOT NULL,
  PRIMARY KEY (user_id, group_key)
);

COMMENT ON TABLE public.pm_new_request_subs IS
  'Users who should be notified for new quick requests in a request-type group.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_new_request_subs TO authenticated;
GRANT ALL ON public.pm_new_request_subs TO service_role;

ALTER TABLE public.pm_new_request_subs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_new_request_subs select authenticated"
  ON public.pm_new_request_subs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "pm_new_request_subs write own"
  ON public.pm_new_request_subs FOR ALL TO authenticated
  USING (user_id = private.current_pm_user_id())
  WITH CHECK (user_id = private.current_pm_user_id());

INSERT INTO public.pm_new_request_subs (user_id, group_key)
SELECT u.id, g.k
FROM public.pm_users u
CROSS JOIN (VALUES
  ('career_site'),
  ('web'),
  ('ads'),
  ('content'),
  ('print'),
  ('media'),
  ('brand'),
  ('other')
) AS g(k)
WHERE COALESCE(u.is_active, true)
  AND COALESCE(u.role, '') IS DISTINCT FROM 'submitter'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.fanout_new_request_notifications(
  p_project_id uuid,
  p_title text,
  p_group_key text,
  p_client_id uuid,
  p_request_type text,
  p_actor_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n integer := 0;
  rec record;
BEGIN
  FOR rec IN
    SELECT DISTINCT uid FROM (
      SELECT s.user_id AS uid
      FROM public.pm_new_request_subs s
      JOIN public.pm_users u ON u.id = s.user_id
      WHERE s.group_key = p_group_key
        AND COALESCE(u.is_active, true)
      UNION
      SELECT w.user_id
      FROM public.pm_client_watchers w
      JOIN public.pm_users u ON u.id = w.user_id
      WHERE p_client_id IS NOT NULL
        AND w.client_id = p_client_id
        AND (w.request_type IS NULL OR w.request_type IS NOT DISTINCT FROM p_request_type)
        AND COALESCE(u.is_active, true)
    ) x
    WHERE uid IS DISTINCT FROM p_actor_id
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.pm_notification_prefs p
      WHERE p.user_id = rec.uid
        AND p.event_type = 'new_request'
        AND p.in_app = false
        AND p.email = false
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.pm_notifications (user_id, type, title, body, link)
    VALUES (
      rec.uid,
      'new_request',
      'New request: ' || COALESCE(p_title, 'Untitled'),
      NULL,
      '/pm/projects/' || p_project_id::text
    );
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.fanout_new_request_notifications(uuid, text, text, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fanout_new_request_notifications(uuid, text, text, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fanout_new_request_notifications(uuid, text, text, uuid, text, uuid) TO service_role;
