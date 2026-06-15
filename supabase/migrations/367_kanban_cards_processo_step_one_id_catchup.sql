-- 367: Catch-up DEV — coluna processo_step_one_id em kanban_cards (migration 324).
-- Sem ela, criar card no Funil Step One falha ao vincular processo (schema cache PostgREST).

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS processo_step_one_id UUID
  REFERENCES public.processo_step_one(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_processo_step_one_id
  ON public.kanban_cards (processo_step_one_id)
  WHERE processo_step_one_id IS NOT NULL;

COMMENT ON COLUMN public.kanban_cards.processo_step_one_id IS
  'Processo Step One vinculado ao card (Funil Step One). Distinto de projeto_id (Portfolio / projeto_negocio).';

NOTIFY pgrst, 'reload schema';
