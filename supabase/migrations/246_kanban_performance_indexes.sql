-- Índices de performance (aplicados em PROD; registro no repo)

CREATE INDEX IF NOT EXISTS idx_checklist_itens_fase_id
  ON kanban_fase_checklist_itens (fase_id, ordem);

CREATE INDEX IF NOT EXISTS idx_checklist_respostas_card_id
  ON kanban_fase_checklist_respostas (card_id);

CREATE INDEX IF NOT EXISTS idx_checklist_respostas_item_id
  ON kanban_fase_checklist_respostas (item_id);

CREATE INDEX IF NOT EXISTS idx_kanban_card_tags_card_id
  ON kanban_card_tags (card_id);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_kanban_id
  ON kanban_cards (kanban_id);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_board_filter
  ON kanban_cards (kanban_id, arquivado, concluido)
  WHERE arquivado = false AND concluido = false;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_franqueado_id
  ON kanban_cards (franqueado_id)
  WHERE franqueado_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_card_ativo
  ON kanban_atividades (card_id, arquivado)
  WHERE arquivado = false;