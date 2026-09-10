-- House account for unbilled engineering Quick Requests.
-- Reassign client_id on the request if/when the work becomes billable.

INSERT INTO public.clients (name, is_internal, notes)
SELECT
  'Dev Internal',
  true,
  'Unbilled engineering overhead (API, reporting, spikes, tech debt, tools, platform). Reassign to a billed client if the work is charged.'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.clients
  WHERE lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = 'dev internal'
);

UPDATE public.clients
SET
  is_internal = true,
  notes = COALESCE(
    nullif(trim(notes), ''),
    'Unbilled engineering overhead (API, reporting, spikes, tech debt, tools, platform). Reassign to a billed client if the work is charged.'
  ),
  archived_at = NULL
WHERE lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = 'dev internal';
