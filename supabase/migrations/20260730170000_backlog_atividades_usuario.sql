CREATE TABLE IF NOT EXISTS backlog_atividades_usuario (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acao_id    uuid NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
  criado_em  timestamptz DEFAULT now(),
  UNIQUE (profile_id, acao_id)
);

ALTER TABLE backlog_atividades_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario ve proprias ativacoes"
  ON backlog_atividades_usuario FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "usuario gerencia proprias ativacoes"
  ON backlog_atividades_usuario FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
