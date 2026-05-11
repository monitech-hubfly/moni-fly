-- Nome do franqueado/condomínio/lote no planejamento (área Acoplamento).
-- Rode no Supabase → SQL Editor (uma vez).
ALTER TABLE gantt_planejamento
  ADD COLUMN IF NOT EXISTS franqueado_nome text;

-- O UNIQUE legado (trimestre_id, acao_id) impede várias linhas por atividade no mesmo trimestre.
-- Para Acoplamento, múltiplas linhas diferenciadas por franqueado_nome precisam desse constraint removido.
ALTER TABLE gantt_planejamento DROP CONSTRAINT IF EXISTS gantt_planejamento_trimestre_id_acao_id_key;
