-- Documentos sensíveis da rede: só admin/team leem no storage (Frank autenticado não baixa).

DROP POLICY IF EXISTS "rede_attachments_select" ON storage.objects;
CREATE POLICY "rede_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rede-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );
