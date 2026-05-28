-- 210: flags de retorno de bastões no card pai + histórico bastao_retorno

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS origem_card_id UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acoplamento_concluido BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credito_terreno_ok BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credito_obra_ok BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contabilidade_ok BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS juridico_ok BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capital_ok BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_origem_card_id
  ON public.kanban_cards (origem_card_id)
  WHERE origem_card_id IS NOT NULL;

COMMENT ON COLUMN public.kanban_cards.origem_card_id IS 'Card pai quando criado por bastão automático entre esteiras.';
COMMENT ON COLUMN public.kanban_cards.acoplamento_concluido IS 'Esteira Acoplamento concluiu (aprovado ou reprovado).';
COMMENT ON COLUMN public.kanban_cards.credito_terreno_ok IS 'Esteira Crédito Terreno concluiu.';
COMMENT ON COLUMN public.kanban_cards.credito_obra_ok IS 'Esteira Crédito Obra concluiu.';
COMMENT ON COLUMN public.kanban_cards.contabilidade_ok IS 'Esteira Contabilidade concluiu.';
COMMENT ON COLUMN public.kanban_cards.juridico_ok IS 'Esteira Jurídico concluiu.';
COMMENT ON COLUMN public.kanban_cards.capital_ok IS 'Esteira Moní Capital concluiu (elegível ou não elegível).';

ALTER TABLE public.kanban_historico
  DROP CONSTRAINT IF EXISTS kanban_historico_acao_check;

ALTER TABLE public.kanban_historico
  ADD CONSTRAINT kanban_historico_acao_check
  CHECK (acao IN (
    'card_criado',
    'fase_avancada',
    'fase_retrocedida',
    'interacao_criada',
    'interacao_editada',
    'campo_alterado',
    'card_arquivado',
    'bastao_retorno'
  ));
