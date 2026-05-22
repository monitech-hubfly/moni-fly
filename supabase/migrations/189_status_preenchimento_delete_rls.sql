-- Permite exclusão (desfazer registro) para usuários autenticados
GRANT DELETE ON status_preenchimento_registros TO authenticated;

DROP POLICY IF EXISTS "delete_authenticated" ON status_preenchimento_registros;

CREATE POLICY "delete_authenticated" ON status_preenchimento_registros
  FOR DELETE USING (auth.uid() IS NOT NULL);

NOTIFY pgrst, 'reload schema';
