-- 214: alertas com referência ao card kanban (menções @ em comentários)

ALTER TABLE public.alertas
  ADD COLUMN IF NOT EXISTS referencia_card_id UUID,
  ADD COLUMN IF NOT EXISTS referencia_path TEXT;

CREATE INDEX IF NOT EXISTS idx_alertas_referencia_card
  ON public.alertas (referencia_card_id)
  WHERE referencia_card_id IS NOT NULL;

COMMENT ON COLUMN public.alertas.referencia_card_id IS
  'Card kanban relacionado (ex.: menção em comentário).';
COMMENT ON COLUMN public.alertas.referencia_path IS
  'Base path do funil para abrir o card (?card=).';
