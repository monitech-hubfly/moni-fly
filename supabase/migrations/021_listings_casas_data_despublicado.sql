-- Data em que o anúncio foi marcado como despublicado (quando não aparece mais na ZAP).
-- Usado para calcular duração do anúncio para itens despublicados.
ALTER TABLE public.listings_casas
  ADD COLUMN IF NOT EXISTS data_despublicado DATE;

COMMENT ON COLUMN public.listings_casas.data_despublicado IS 'Data em que o anúncio deixou de aparecer na ZAP (status despublicado). Para duração: despublicado = data_despublicado - data_publicacao.';
