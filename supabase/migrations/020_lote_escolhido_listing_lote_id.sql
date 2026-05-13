-- Etapa 4: permitir escolher 1 lote da listagem; referência em lote_escolhido
ALTER TABLE public.lote_escolhido
  ADD COLUMN IF NOT EXISTS listing_lote_id UUID REFERENCES public.listings_lotes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.lote_escolhido.listing_lote_id IS 'Lote escolhido na Etapa 4 (listagem de lotes).';
