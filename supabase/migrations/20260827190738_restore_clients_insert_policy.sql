-- Re-enable approved staff to create clients (dropped in 20260826180000).
-- Public/anon still cannot insert; uniqueness remains enforced by clients_name_normalized_unique.

DROP POLICY IF EXISTS clients_insert_approved ON public.clients;

CREATE POLICY clients_insert_approved
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (private.is_approved_pm_user());
