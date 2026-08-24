-- Allow edge functions to resolve secrets from vault when Deno.env edge
-- secrets are unset (Management API secrets endpoint may be unavailable).
-- Actual secret values are stored in vault via dashboard/ops — never commit them.

CREATE OR REPLACE FUNCTION private.get_edge_secret(secret_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'vault', 'private', 'public'
AS $$
DECLARE
  v text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  SELECT decrypted_secret INTO v
  FROM vault.decrypted_secrets
  WHERE name = secret_name
  LIMIT 1;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION private.get_edge_secret(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_edge_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_edge_secret(secret_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'private', 'public'
AS $$
  SELECT private.get_edge_secret(secret_name);
$$;

REVOKE ALL ON FUNCTION public.get_edge_secret(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_edge_secret(text) TO service_role;
