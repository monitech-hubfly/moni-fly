-- =============================================================================
-- Pastelaria — responsável nos cards (Supabase SQL Editor)
-- Depois: NOTIFY pgrst, 'reload schema';
-- =============================================================================

ALTER TABLE pastelaria_cards
  ADD COLUMN IF NOT EXISTS responsavel_id uuid
    REFERENCES area_pessoas(id) ON DELETE SET NULL;

ALTER TABLE pastelaria_cards
  ADD COLUMN IF NOT EXISTS responsavel_nome text;

CREATE INDEX IF NOT EXISTS idx_pastelaria_cards_responsavel
  ON pastelaria_cards(responsavel_id);

-- Log: permitir ação pessoa_adicionada
ALTER TABLE pastelaria_log DROP CONSTRAINT IF EXISTS pastelaria_log_acao_check;

ALTER TABLE pastelaria_log ADD CONSTRAINT pastelaria_log_acao_check
  CHECK (acao IN (
    'criado', 'coluna_alterada', 'aceito', 'reclassificado',
    'horas_registradas', 'editado', 'excluido', 'pessoa_adicionada'
  ));
