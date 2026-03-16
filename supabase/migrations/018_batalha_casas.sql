-- Batalha de casas (Etapa 5) — escolha de até 3 casas e notas por anúncio

CREATE TABLE IF NOT EXISTS public.casas_escolhidas_etapa5 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings_casas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT casas_escolhidas_etapa5_unq UNIQUE (processo_id, listing_id)
);

COMMENT ON TABLE public.casas_escolhidas_etapa5 IS 'Casas do nosso catálogo (via listings_casas) escolhidas pelo franqueado para a batalha da Etapa 5.';

CREATE TABLE IF NOT EXISTS public.batalha_casas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  casa_escolhida_id UUID NOT NULL REFERENCES public.casas_escolhidas_etapa5(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings_casas(id) ON DELETE CASCADE,
  nota_preco NUMERIC(4,2),
  nota_produto NUMERIC(4,2),
  nota_localizacao NUMERIC(4,2),
  nota_final NUMERIC(4,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT batalha_casas_unq UNIQUE (processo_id, casa_escolhida_id, listing_id)
);

COMMENT ON TABLE public.batalha_casas IS 'Notas da batalha de casas na Etapa 5 (preço, produto, localização e nota final ponderada).';

CREATE INDEX IF NOT EXISTS idx_casas_escolhidas_etapa5_processo ON public.casas_escolhidas_etapa5(processo_id);
CREATE INDEX IF NOT EXISTS idx_batalha_casas_processo ON public.batalha_casas(processo_id);

