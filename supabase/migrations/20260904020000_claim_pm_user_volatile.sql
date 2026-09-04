-- public.claim_pm_user was incorrectly declared STABLE. PostgREST runs STABLE
-- RPCs in a read-only transaction, which breaks private.claim_pm_user's
-- INSERT/UPDATE on pm_users ("cannot execute UPDATE in a read-only transaction").
-- Recreate the wrapper as VOLATILE so writes succeed.

DROP FUNCTION IF EXISTS public.claim_pm_user();

CREATE FUNCTION public.claim_pm_user()
RETURNS uuid
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, private
AS $$ SELECT private.claim_pm_user(); $$;

REVOKE ALL ON FUNCTION public.claim_pm_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_pm_user() TO authenticated;
