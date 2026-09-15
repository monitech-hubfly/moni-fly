-- Adiciona política UPDATE para que usuário possa fazer upsert no próprio snapshot.
-- Necessário para useMeuCarometro salvar snapshot via cliente do browser.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'carometro_status_diario'
      AND policyname = 'Usuário atualiza próprio status'
  ) THEN
    CREATE POLICY "Usuário atualiza próprio status" ON carometro_status_diario
      FOR UPDATE
      USING (profile_id = auth.uid())
      WITH CHECK (profile_id = auth.uid());
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
