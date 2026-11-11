-- Upload do PDF pelo usuário autenticado no bucket privado.
DROP POLICY IF EXISTS "livros_storage_insert" ON storage.objects;
CREATE POLICY "livros_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'livros-empreendimento');
