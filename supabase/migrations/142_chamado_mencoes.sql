-- Tabela de menções vinculadas a comentários do Sirene
CREATE TABLE chamado_mencoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comentario_id BIGINT NOT NULL REFERENCES sirene_mensagens(id) ON DELETE CASCADE,
  mencionado_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chamado_id BIGINT NOT NULL REFERENCES sirene_chamados(id) ON DELETE CASCADE,
  lido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chamado_mencoes ENABLE ROW LEVEL SECURITY;

-- Usuário vê só as próprias menções
DROP POLICY IF EXISTS "mencoes_select_proprio" ON chamado_mencoes;
CREATE POLICY "mencoes_select_proprio" ON chamado_mencoes
  FOR SELECT USING (mencionado_id = auth.uid());

-- Apenas autenticados inserem (Frank bloqueado via app, não via RLS)
DROP POLICY IF EXISTS "mencoes_insert_autenticado" ON chamado_mencoes;
CREATE POLICY "mencoes_insert_autenticado" ON chamado_mencoes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Marcar como lido
DROP POLICY IF EXISTS "mencoes_update_proprio" ON chamado_mencoes;
CREATE POLICY "mencoes_update_proprio" ON chamado_mencoes
  FOR UPDATE USING (mencionado_id = auth.uid());

-- Índices
CREATE INDEX idx_mencoes_mencionado ON chamado_mencoes(mencionado_id);
CREATE INDEX idx_mencoes_comentario ON chamado_mencoes(comentario_id);
