-- Etapa 5 (lotes): $ condomínio, IPTU e características do condomínio

ALTER TABLE public.listings_lotes
  ADD COLUMN IF NOT EXISTS valor_condominio NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS iptu NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS caracteristicas_condominio TEXT;

COMMENT ON COLUMN public.listings_lotes.valor_condominio IS 'Valor do condomínio (R$/mês)';
COMMENT ON COLUMN public.listings_lotes.iptu IS 'IPTU (R$)';
COMMENT ON COLUMN public.listings_lotes.caracteristicas_condominio IS 'Características do condomínio (ex.: Salão de festas, Piscina, Academia)';
