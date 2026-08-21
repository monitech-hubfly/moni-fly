-- Índice para chips paralelas (Portfolio/Operações): filhos por origem_card_id
CREATE INDEX IF NOT EXISTS idx_kanban_cards_origem_card_id
  ON public.kanban_cards (origem_card_id)
  WHERE origem_card_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
