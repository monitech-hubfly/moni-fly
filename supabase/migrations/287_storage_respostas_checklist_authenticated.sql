-- 287: Permite upload de anexos de checklist/respostas do kanban por usuários autenticados.
-- Corrige "new row violates row-level security policy" ao enviar fotos de lote, mapa, etc.
-- Templates administrativos (raiz do bucket) continuam restritos a admin via templates_insert_admin.

DROP POLICY IF EXISTS "templates_respostas_insert_auth" ON storage.objects;
CREATE POLICY "templates_respostas_insert_auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-templates'
    AND (storage.foldername(name))[1] = 'respostas'
    AND EXISTS (
      SELECT 1
      FROM public.kanban_cards c
      WHERE c.id::text = (storage.foldername(name))[2]
    )
  );

DROP POLICY IF EXISTS "templates_respostas_update_auth" ON storage.objects;
CREATE POLICY "templates_respostas_update_auth" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos-templates'
    AND (storage.foldername(name))[1] = 'respostas'
    AND EXISTS (
      SELECT 1
      FROM public.kanban_cards c
      WHERE c.id::text = (storage.foldername(name))[2]
    )
  )
  WITH CHECK (
    bucket_id = 'documentos-templates'
    AND (storage.foldername(name))[1] = 'respostas'
    AND EXISTS (
      SELECT 1
      FROM public.kanban_cards c
      WHERE c.id::text = (storage.foldername(name))[2]
    )
  );

DROP POLICY IF EXISTS "templates_respostas_delete_auth" ON storage.objects;
CREATE POLICY "templates_respostas_delete_auth" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos-templates'
    AND (storage.foldername(name))[1] = 'respostas'
    AND EXISTS (
      SELECT 1
      FROM public.kanban_cards c
      WHERE c.id::text = (storage.foldername(name))[2]
    )
  );

-- Sincronização de lotes do funil Step One com o cadastro central (condominios_lotes).
DROP POLICY IF EXISTS "condominios_lotes_insert_authenticated" ON public.condominios_lotes;
CREATE POLICY "condominios_lotes_insert_authenticated"
  ON public.condominios_lotes FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "condominios_lotes_update_authenticated" ON public.condominios_lotes;
CREATE POLICY "condominios_lotes_update_authenticated"
  ON public.condominios_lotes FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
