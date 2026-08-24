-- 546: Flag obra_ok em kanban_cards (bastão de volta Funil Obra → pai Pré Obra).
-- Idempotente. DEV first.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS obra_ok boolean DEFAULT false;

COMMENT ON COLUMN public.kanban_cards.obra_ok IS
  'Bastão de volta: true quando filho no Funil Obra chega em obra_entrega.';

NOTIFY pgrst, 'reload schema';
