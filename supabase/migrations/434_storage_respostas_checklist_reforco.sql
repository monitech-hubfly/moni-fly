-- 434: Reforço idempotente das policies de upload em documentos-templates/respostas/*
-- (migration 287). Corrige RLS ao anexar arquivos no checklist kanban quando DEV ficou desatualizado.

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

NOTIFY pgrst, 'reload schema';
