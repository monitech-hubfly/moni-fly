-- Dados de negócio (condomínio / quadra / lote) em cards nativos sem processo vinculado.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS nome_condominio TEXT,
  ADD COLUMN IF NOT EXISTS quadra TEXT,
  ADD COLUMN IF NOT EXISTS lote TEXT;

COMMENT ON COLUMN public.kanban_cards.nome_condominio IS 'Nome do condomínio (dados do negócio no card nativo).';
COMMENT ON COLUMN public.kanban_cards.quadra IS 'Quadra (dados do negócio no card nativo).';
COMMENT ON COLUMN public.kanban_cards.lote IS 'Lote (dados do negócio no card nativo).';
