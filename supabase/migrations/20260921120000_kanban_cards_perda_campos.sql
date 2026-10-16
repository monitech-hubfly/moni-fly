-- Adiciona colunas de perda e ganho em kanban_cards.
-- A tabela kanban_motivos_perda ja existe no banco (criada manualmente).
-- Este migration registra as colunas que o codigo ja espera encontrar.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS motivo_perda_id    UUID
    REFERENCES public.kanban_motivos_perda(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS justificativa_perda TEXT,
  ADD COLUMN IF NOT EXISTS justificativa_ganho TEXT;

COMMENT ON COLUMN public.kanban_cards.motivo_perda_id    IS 'Motivo selecionado ao registrar perda (FK para kanban_motivos_perda).';
COMMENT ON COLUMN public.kanban_cards.justificativa_perda IS 'Descricao livre informada ao registrar perda do card.';
COMMENT ON COLUMN public.kanban_cards.justificativa_ganho IS 'Descricao livre informada ao registrar ganho do card.';

-- Garante que as roles do app possam ler os motivos de perda.
-- Em DEV a tabela foi criada manualmente sem esses GRANTs (causa do erro 42501).
GRANT SELECT ON public.kanban_motivos_perda TO authenticated;
GRANT SELECT ON public.kanban_motivos_perda TO anon;
