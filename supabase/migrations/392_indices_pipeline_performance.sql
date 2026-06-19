-- Índices para performance do pipeline (cards + histórico/atividades lazy)
-- Idempotente: IF NOT EXISTS

CREATE INDEX IF NOT EXISTS idx_kanban_cards_rede_franqueado
  ON public.kanban_cards (rede_franqueado_id)
  WHERE arquivado = false;

CREATE INDEX IF NOT EXISTS idx_kanban_historico_card_id
  ON public.kanban_historico (card_id);

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_card_id
  ON public.kanban_atividades (card_id);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('392', 'indices_pipeline_performance')
ON CONFLICT (version) DO NOTHING;
