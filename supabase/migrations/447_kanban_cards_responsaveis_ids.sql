-- 447: Adiciona coluna responsaveis_ids em kanban_cards
-- Coluna ausente causava falha silenciosa no useBacklogKanban (fonte 4/proxima_atividade)
-- quando o filtro OR usava responsaveis_ids.cs.{uuid} numa tabela sem a coluna.

ALTER TABLE kanban_cards
  ADD COLUMN IF NOT EXISTS responsaveis_ids uuid[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_kanban_cards_responsaveis_ids
  ON kanban_cards USING GIN (responsaveis_ids)
  WHERE array_length(responsaveis_ids, 1) > 0;

NOTIFY pgrst, 'reload schema';
