-- Lotes adicionados manualmente: flag e validação mensal (espelha 014 para casas)

ALTER TABLE public.listings_lotes
  ADD COLUMN IF NOT EXISTS manual BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.listings_lotes.manual IS 'true = cadastrado manualmente pelo franqueado; false = vindo da varredura ZAP';

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS ultima_validacao_lotes_manuais_em DATE;

COMMENT ON COLUMN public.processo_step_one.ultima_validacao_lotes_manuais_em IS 'Última data em que o franqueado validou o status dos lotes manuais (alerta mensal)';
