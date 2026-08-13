-- Migration: concluido per-user em objetivo_responsaveis
-- Permite que cada responsável de uma meta marque sua própria conclusão
-- independentemente dos outros responsáveis.

ALTER TABLE objetivo_responsaveis
  ADD COLUMN IF NOT EXISTS concluido    boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz;

-- Policy UPDATE: cada usuário pode marcar/desmarcar sua própria conclusão
-- Admins podem atualizar qualquer registro (já cobertos pela policy de datas)
DROP POLICY IF EXISTS "objetivo_responsaveis_update_concluido" ON objetivo_responsaveis;
CREATE POLICY "objetivo_responsaveis_update_concluido"
  ON objetivo_responsaveis FOR UPDATE TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

NOTIFY pgrst, 'reload schema';
