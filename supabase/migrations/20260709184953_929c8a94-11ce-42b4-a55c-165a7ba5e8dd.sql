
ALTER TABLE public.mock_users ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT '{}';
UPDATE public.mock_users
SET roles = ARRAY(SELECT DISTINCT r FROM unnest(ARRAY[role, secondary_role]) AS r WHERE r IS NOT NULL)
WHERE roles = '{}' OR roles IS NULL;
UPDATE public.mock_users SET roles = ARRAY['pm','designer','developer']
WHERE id = '2cd08a7f-035c-4956-b2a9-ee202fb67a8a';
