-- Etapa 1 — Análise da praça: observações do Frank e código IBGE do município
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS observacoes_praca TEXT,
  ADD COLUMN IF NOT EXISTS cidade_ibge_cod TEXT;

COMMENT ON COLUMN public.processo_step_one.observacoes_praca IS 'Observações livres do Frank sobre a praça (Etapa 1)';
COMMENT ON COLUMN public.processo_step_one.cidade_ibge_cod IS 'Código do município no IBGE (id do localidades)';
