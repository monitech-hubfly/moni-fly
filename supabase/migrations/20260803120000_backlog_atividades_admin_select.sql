-- Permite admin ler backlog_atividades_usuario de qualquer usuário (para simulação)
-- Condição original (profile_id = auth.uid()) preservada — admin é adição.

DROP POLICY IF EXISTS "usuario ve proprias ativacoes" ON backlog_atividades_usuario;

CREATE POLICY "usuario ve proprias ativacoes"
  ON backlog_atividades_usuario FOR SELECT
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
