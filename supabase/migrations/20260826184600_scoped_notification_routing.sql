-- Scoped notification routing: creative/production intake only, eligible recipients only.

CREATE OR REPLACE FUNCTION private.is_creative_production_recipient(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pm_users u
    WHERE u.id = p_user_id
      AND COALESCE(u.is_active, true)
      AND (
        lower(trim(u.email)) IN ('dan.heselton@hireclix.com', 'lisa.thompson@hireclix.com')
        OR u.role IN ('designer', 'developer')
        OR u.roles && ARRAY['designer', 'developer', 'tech_lead']::text[]
      )
  );
$$;

REVOKE ALL ON FUNCTION private.is_creative_production_recipient(uuid) FROM PUBLIC;

-- Drop blanket all-user subscriptions.
DELETE FROM public.pm_new_request_subs;

INSERT INTO public.pm_new_request_subs (user_id, group_key)
SELECT u.id, g.k
FROM public.pm_users u
CROSS JOIN (
  VALUES
    ('web'),
    ('print'),
    ('media'),
    ('brand'),
    ('content'),
    ('ads'),
    ('career_site')
) AS g(k)
WHERE COALESCE(u.is_active, true)
  AND private.is_creative_production_recipient(u.id)
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
  -- Non-creative requests (general/other) stay on the dashboard only.
  IF p_group_key IS NULL OR p_group_key = 'other' THEN
    RETURN 0;
  END IF;

  IF p_group_key NOT IN ('web', 'print', 'media', 'brand', 'content', 'ads', 'career_site') THEN
    RETURN 0;
  END IF;

  FOR rec IN
    SELECT DISTINCT uid FROM (
      SELECT s.user_id AS uid
      FROM public.pm_new_request_subs s
      WHERE s.group_key = p_group_key
      UNION
      SELECT w.user_id
      FROM public.pm_client_watchers w
      WHERE p_client_id IS NOT NULL
        AND w.client_id = p_client_id
        AND (w.request_type IS NULL OR w.request_type IS NOT DISTINCT FROM p_request_type)
    ) x
    WHERE uid IS DISTINCT FROM p_actor_id
      AND private.is_creative_production_recipient(uid)
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

-- Default new_request and unclaimed_team off for active users without existing prefs.
INSERT INTO public.pm_notification_prefs (user_id, event_type, in_app, email)
SELECT u.id, et.event_type, false, false
FROM public.pm_users u
CROSS JOIN (VALUES ('new_request'), ('unclaimed_team')) AS et(event_type)
WHERE COALESCE(u.is_active, true)
ON CONFLICT (user_id, event_type) DO NOTHING;
