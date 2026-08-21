-- 162: sirene_chamados — vínculo opcional a card do kanban + prazo para ordenação na lista.
-- Expande CHECK de tipo em kanban_atividades para incluir chamados Sirene espelhados na board.

ALTER TABLE public.sirene_chamados
  ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS card_kanban_nome TEXT,
  ADD COLUMN IF NOT EXISTS card_titulo TEXT,
  ADD COLUMN IF NOT EXISTS data_vencimento DATE;

COMMENT ON COLUMN public.sirene_chamados.card_id IS 'Card de kanban (nativo) vinculado ao chamado, se houver.';
COMMENT ON COLUMN public.sirene_chamados.card_kanban_nome IS 'Nome do kanban em kanbans.nome (para rota do funil).';
COMMENT ON COLUMN public.sirene_chamados.card_titulo IS 'Título do card no momento do vínculo.';
COMMENT ON COLUMN public.sirene_chamados.data_vencimento IS 'Prazo exibido na ordenação da lista de chamados (opcional).';

CREATE INDEX IF NOT EXISTS idx_sirene_chamados_card_id
  ON public.sirene_chamados(card_id)
  WHERE card_id IS NOT NULL;

ALTER TABLE public.kanban_atividades DROP CONSTRAINT IF EXISTS kanban_atividades_tipo_check;

ALTER TABLE public.kanban_atividades
  ADD CONSTRAINT kanban_atividades_tipo_check
  CHECK (tipo IN ('atividade', 'duvida', 'chamado_padrao', 'chamado_hdm'));

NOTIFY pgrst, 'reload schema';
