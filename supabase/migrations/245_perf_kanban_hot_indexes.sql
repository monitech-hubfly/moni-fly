-- 245: índices compostos para queries quentes do board kanban (snapshot + chips paralelas)
-- Additive only — sem alteração de schema ou comportamento.

-- Board snapshot: kanban_id + status + arquivado + concluido + ordem_coluna
CREATE INDEX IF NOT EXISTS idx_kanban_cards_board_snapshot
  ON public.kanban_cards (kanban_id, status, arquivado, concluido, ordem_coluna);

-- Agrupamento por coluna / fase no board
CREATE INDEX IF NOT EXISTS idx_kanban_cards_kanban_fase
  ON public.kanban_cards (kanban_id, fase_id);

-- Tags por card (IN card_id no snapshot)
CREATE INDEX IF NOT EXISTS idx_kanban_card_tags_card_id
  ON public.kanban_card_tags (card_id);

-- Chips Step One → Portfolio (projeto_id por kanban, cards ativos)
CREATE INDEX IF NOT EXISTS idx_kanban_cards_kanban_projeto_ativo
  ON public.kanban_cards (kanban_id, projeto_id)
  WHERE arquivado = false AND concluido = false;

-- Filhos por origem_card_id (Portfolio → Jurídico / Acoplamento)
CREATE INDEX IF NOT EXISTS idx_kanban_cards_kanban_origem
  ON public.kanban_cards (kanban_id, origem_card_id);

-- Legado: nome do franqueado via numero_franquia
CREATE INDEX IF NOT EXISTS idx_rede_franqueados_n_franquia
  ON public.rede_franqueados (n_franquia)
  WHERE n_franquia IS NOT NULL;

-- Modal: atividades ativas por card
CREATE INDEX IF NOT EXISTS idx_kanban_atividades_card_ativo
  ON public.kanban_atividades (card_id, arquivado)
  WHERE arquivado = false;
