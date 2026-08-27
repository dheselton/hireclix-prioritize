-- Remove seeded sample client and block new client creation going forward.
-- Existing clients remain selectable; updates/archives still allowed.

DELETE FROM public.clients
WHERE lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = lower('Acme Corp');

DROP POLICY IF EXISTS clients_insert_approved ON public.clients;
