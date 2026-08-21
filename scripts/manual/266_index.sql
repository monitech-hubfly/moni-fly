-- SQL Editor: índice parcial (sem CONCURRENTLY — roda em transação)
CREATE INDEX IF NOT EXISTS idx_kanban_cards_rede_null_origem
  ON public.kanban_cards (origem_card_id)
  WHERE rede_franqueado_id IS NULL AND origem_card_id IS NOT NULL;
