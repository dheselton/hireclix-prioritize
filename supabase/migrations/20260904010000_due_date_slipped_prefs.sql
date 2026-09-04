-- Seed notification prefs for the new due_date_slipped event type for existing users.
-- Defaults: in_app + email ON (same as overdue's historical default; users can opt out in Settings).

INSERT INTO public.pm_notification_prefs (user_id, event_type, in_app, email)
SELECT u.id, 'due_date_slipped', true, true
FROM public.pm_users u
WHERE COALESCE(u.is_active, true)
ON CONFLICT (user_id, event_type) DO NOTHING;
