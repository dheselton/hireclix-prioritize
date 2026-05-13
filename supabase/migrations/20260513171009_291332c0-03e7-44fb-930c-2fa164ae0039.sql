
ALTER TABLE public.mock_users DROP CONSTRAINT IF EXISTS mock_users_role_check;
ALTER TABLE public.mock_users ADD CONSTRAINT mock_users_role_check
  CHECK (role IN ('pm','designer','developer','submitter','strategist','analyst'));
