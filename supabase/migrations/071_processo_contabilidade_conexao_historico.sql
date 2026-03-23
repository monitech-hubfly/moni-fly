-- Conexão entre card pai (Novos Negócios) e cards filhos no Painel de Contabilidade.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS origem_contabilidade_processo_id UUID REFERENCES public.processo_step_one(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.processo_step_one.origem_contabilidade_processo_id
  IS 'Se preenchido, indica que este card é filho criado no Painel Contabilidade a partir deste processo pai.';

-- Compatibilidade com versão antiga (coluna "contabilidade" no fluxo principal)
UPDATE public.processo_step_one
SET etapa_painel = 'contabilidade_incorporadora'
WHERE etapa_painel = 'contabilidade';

-- Evitar duplicação de filhos no painel contabilidade.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_contabilidade_filhos_uma_vez
ON public.processo_step_one (origem_contabilidade_processo_id, etapa_painel)
WHERE origem_contabilidade_processo_id IS NOT NULL
  AND etapa_painel IN ('contabilidade_incorporadora', 'contabilidade_spe', 'contabilidade_gestora');

