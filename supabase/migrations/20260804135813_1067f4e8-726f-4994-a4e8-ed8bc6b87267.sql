CREATE POLICY "portal_attachments_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'portal-attachments');
CREATE POLICY "portal_attachments_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'portal-attachments');
CREATE POLICY "portal_attachments_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'portal-attachments') WITH CHECK (bucket_id = 'portal-attachments');
CREATE POLICY "portal_attachments_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'portal-attachments');