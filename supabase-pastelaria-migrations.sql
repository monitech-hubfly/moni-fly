-- =============================================================================
-- Pastelaria — migrações pontuais (Supabase SQL Editor)
-- Execute após supabase-pastelaria.sql, se o banco já existia antes destas mudanças.
-- Depois: NOTIFY pgrst, 'reload schema';
-- =============================================================================

-- 1) Unidade nas horas (h = horas, min = minutos)
ALTER TABLE pastelaria_horas
  ADD COLUMN IF NOT EXISTS unidade text DEFAULT 'h';

-- 2) Reclassificações sobrevivem ao DELETE do card (antes: ON DELETE CASCADE apagava o registro)
ALTER TABLE pastelaria_reclassificacoes
  DROP CONSTRAINT IF EXISTS pastelaria_reclassificacoes_card_id_fkey;

ALTER TABLE pastelaria_reclassificacoes
  ALTER COLUMN card_id DROP NOT NULL;

ALTER TABLE pastelaria_reclassificacoes
  ADD CONSTRAINT pastelaria_reclassificacoes_card_id_fkey
  FOREIGN KEY (card_id) REFERENCES pastelaria_cards(id) ON DELETE SET NULL;

-- 3) Reclassificação sem deletar o card (soft-hide no kanban, histórico no log)
ALTER TABLE pastelaria_cards
  ADD COLUMN IF NOT EXISTS reclassificado boolean DEFAULT false;

ALTER TABLE pastelaria_cards
  ADD COLUMN IF NOT EXISTS reclassificado_em timestamptz;

ALTER TABLE pastelaria_cards
  ADD COLUMN IF NOT EXISTS reclassificado_destino text;

ALTER TABLE pastelaria_cards
  ADD COLUMN IF NOT EXISTS reclassificado_justificativa text;

CREATE INDEX IF NOT EXISTS idx_pastelaria_cards_reclass ON pastelaria_cards(reclassificado);

-- 4) Responsável nos cards
ALTER TABLE pastelaria_cards
  ADD COLUMN IF NOT EXISTS responsavel_id uuid
    REFERENCES area_pessoas(id) ON DELETE SET NULL;

ALTER TABLE pastelaria_cards
  ADD COLUMN IF NOT EXISTS responsavel_nome text;

CREATE INDEX IF NOT EXISTS idx_pastelaria_cards_responsavel
  ON pastelaria_cards(responsavel_id);

ALTER TABLE pastelaria_log DROP CONSTRAINT IF EXISTS pastelaria_log_acao_check;

ALTER TABLE pastelaria_log ADD CONSTRAINT pastelaria_log_acao_check
  CHECK (acao IN (
    'criado', 'coluna_alterada', 'aceito', 'reclassificado',
    'horas_registradas', 'editado', 'excluido', 'pessoa_adicionada'
  ));

-- 5) View Gantt — ver supabase-pastelaria-gantt-view.sql (CREATE OR REPLACE VIEW completo)
