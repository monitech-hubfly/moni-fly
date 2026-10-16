-- 586: Cadastro de Condomínios — lançamento de vendas, TVO e dados de lotes/casas.
-- Idempotente. Não apaga colunas existentes.

ALTER TABLE public.condominios
  ADD COLUMN IF NOT EXISTS data_lancamento_vendas date,
  ADD COLUMN IF NOT EXISTS data_liberacao_tvo date,
  ADD COLUMN IF NOT EXISTS quantidade_lotes integer,
  ADD COLUMN IF NOT EXISTS metragem_lotes text,
  ADD COLUMN IF NOT EXISTS metragem_casas text,
  ADD COLUMN IF NOT EXISTS planta_cadastral text,
  ADD COLUMN IF NOT EXISTS manual_obras text,
  ADD COLUMN IF NOT EXISTS casas_concorrentes text;

COMMENT ON COLUMN public.condominios.data_lancamento_vendas IS
  'Data de lançamento (vendas de lote).';
COMMENT ON COLUMN public.condominios.data_liberacao_tvo IS
  'Data liberação TVO (permissão de construir casas).';

NOTIFY pgrst, 'reload schema';
