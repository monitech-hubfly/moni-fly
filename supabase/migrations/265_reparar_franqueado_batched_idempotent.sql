-- 265: Reparo idempotente de rede_franqueado_id — índice + delegação para 265b/265c/265d.
-- O loop completo da 262 estourava timeout no SQL Editor; lotes de 100 ficam em arquivos separados.
-- Manual: supabase/migrations/MANUAL_RUN_264_265.md

CREATE INDEX IF NOT EXISTS idx_kanban_cards_rede_null_origem
  ON public.kanban_cards (origem_card_id)
  WHERE rede_franqueado_id IS NULL AND origem_card_id IS NOT NULL;

-- Reparo em massa: execute 265b → 265c → 265d no SQL Editor (repetindo cada um até verificação = 0).
-- Alternativa ultra-leve (1 lote por clique): migration 266.
