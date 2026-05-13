-- Casas adicionadas manualmente: flag e validação mensal de status

ALTER TABLE public.listings_casas
  ADD COLUMN IF NOT EXISTS manual BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.listings_casas.manual IS 'true = cadastrada manualmente pelo franqueado; false = vinda da varredura ZAP';

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS ultima_validacao_casas_manuais_em DATE;

COMMENT ON COLUMN public.processo_step_one.ultima_validacao_casas_manuais_em IS 'Última data em que o franqueado validou o status das casas manuais (alerta mensal)';
