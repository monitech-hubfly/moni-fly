-- Migration 510: substituição de franqueado em transferência (histórico preservado)

CREATE TABLE IF NOT EXISTS public.rede_franqueado_substituicoes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rede_franqueado_id    UUID NOT NULL REFERENCES public.rede_franqueados(id) ON DELETE CASCADE,
  snapshot              JSONB NOT NULL,
  processo_step_one_id  UUID REFERENCES public.processo_step_one(id) ON DELETE SET NULL,
  substituido_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  substituido_por       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  nome_anterior         TEXT,
  n_franquia_anterior   TEXT
);

CREATE INDEX IF NOT EXISTS idx_rede_substituicoes_rede_id
  ON public.rede_franqueado_substituicoes (rede_franqueado_id, substituido_em DESC);

COMMENT ON TABLE public.rede_franqueado_substituicoes IS
  'Histórico de franqueados substituídos em uma mesma linha da rede (em transferência).';

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS rede_substituicao_id UUID
    REFERENCES public.rede_franqueado_substituicoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_rede_substituicao_id
  ON public.kanban_cards (rede_substituicao_id)
  WHERE rede_substituicao_id IS NOT NULL;

COMMENT ON COLUMN public.kanban_cards.rede_substituicao_id IS
  'Quando preenchido, o card pertence ao histórico de substituição (não aparece na operação atual).';

NOTIFY pgrst, 'reload schema';
