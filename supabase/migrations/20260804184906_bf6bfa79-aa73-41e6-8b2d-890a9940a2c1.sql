CREATE POLICY "client_assets_select" ON storage.objects FOR SELECT USING (bucket_id = 'client-assets');
CREATE POLICY "client_assets_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'client-assets');
CREATE POLICY "client_assets_update" ON storage.objects FOR UPDATE USING (bucket_id = 'client-assets');
CREATE POLICY "client_assets_delete" ON storage.objects FOR DELETE USING (bucket_id = 'client-assets');