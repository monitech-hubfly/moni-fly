-- Conexão entre card "pai" (Step 3/6) e card "filho" no Painel Crédito.
-- Também habilita compartilhamento do mesmo histórico/dados via historico_base_id.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS historico_base_id UUID REFERENCES public.processo_step_one(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem_credito_processo_id UUID REFERENCES public.processo_step_one(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.processo_step_one.historico_base_id IS 'ID base para compartilhar histórico/dados entre cards conectados (ex.: crédito).';
COMMENT ON COLUMN public.processo_step_one.origem_credito_processo_id IS 'Se preenchido, indica que este card é filho criado no Painel Crédito a partir deste processo pai.';

-- Backfill: processos existentes passam a usar o próprio id como base.
UPDATE public.processo_step_one
SET historico_base_id = id
WHERE historico_base_id IS NULL;

-- Evitar duplicar cards filhos no crédito.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_credito_filhos_uma_vez
ON public.processo_step_one (origem_credito_processo_id, etapa_painel)
WHERE origem_credito_processo_id IS NOT NULL;

