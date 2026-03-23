-- Observações do formulário inicial (abertura do processo/card no Painel)
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

COMMENT ON COLUMN public.processo_step_one.observacoes IS 'Observações preenchidas no formulário de abertura do processo (Novo card / Novo Step 1).';
