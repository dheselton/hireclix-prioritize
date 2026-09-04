-- Client logos for Live Career Sites cards and project headers.
-- Public bucket so grid renders don't need signed URLs per card.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS logo_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-logos',
  'client-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "client logos public read" ON storage.objects;
CREATE POLICY "client logos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'client-logos');

DROP POLICY IF EXISTS "client logos authenticated insert" ON storage.objects;
CREATE POLICY "client logos authenticated insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-logos');

DROP POLICY IF EXISTS "client logos authenticated update" ON storage.objects;
CREATE POLICY "client logos authenticated update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'client-logos')
  WITH CHECK (bucket_id = 'client-logos');

DROP POLICY IF EXISTS "client logos authenticated delete" ON storage.objects;
CREATE POLICY "client logos authenticated delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-logos');
