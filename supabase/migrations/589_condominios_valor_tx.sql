-- 589: Cadastro de Condomínios — Valor Tx Condomínio.
-- Idempotente. Não apaga colunas existentes.

ALTER TABLE public.condominios
  ADD COLUMN IF NOT EXISTS valor_tx_condominio text;

COMMENT ON COLUMN public.condominios.valor_tx_condominio IS
  'Valor Tx Condomínio. Texto livre (valor ou faixa).';

NOTIFY pgrst, 'reload schema';
