-- As 3 casas da batalha vêm do catálogo Moní (catalogo_casas), não da listagem

ALTER TABLE public.casas_escolhidas_etapa5
  DROP CONSTRAINT IF EXISTS casas_escolhidas_etapa5_unq,
  DROP COLUMN IF EXISTS listing_id;

ALTER TABLE public.casas_escolhidas_etapa5
  ADD COLUMN IF NOT EXISTS catalogo_casa_id UUID REFERENCES public.catalogo_casas(id) ON DELETE CASCADE;

ALTER TABLE public.casas_escolhidas_etapa5
  ADD CONSTRAINT casas_escolhidas_etapa5_unq UNIQUE (processo_id, catalogo_casa_id);

COMMENT ON COLUMN public.casas_escolhidas_etapa5.catalogo_casa_id IS 'Modelo do catálogo Moní escolhido para a batalha (até 3 por processo).';
