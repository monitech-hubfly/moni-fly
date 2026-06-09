-- psql / conexão direta APENAS: CONCURRENTLY não roda dentro de transação do SQL Editor.
-- Cole só este arquivo e execute fora de BEGIN/COMMIT. Pule se 266_index.sql já criou o índice.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kanban_cards_rede_null_origem
  ON public.kanban_cards (origem_card_id)
  WHERE rede_franqueado_id IS NULL AND origem_card_id IS NOT NULL;
