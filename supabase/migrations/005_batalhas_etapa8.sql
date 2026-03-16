-- Etapa 8: Batalhas (preço, produto, localização) — uma linha por par (casa ZAP, casa catálogo)
CREATE TABLE IF NOT EXISTS public.batalhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  listing_casa_id UUID NOT NULL REFERENCES public.listings_casas(id) ON DELETE CASCADE,
  catalogo_casa_id UUID NOT NULL REFERENCES public.catalogo_casas(id) ON DELETE CASCADE,
  nota_preco SMALLINT CHECK (nota_preco >= -2 AND nota_preco <= 2),
  nota_produto SMALLINT CHECK (nota_produto >= -2 AND nota_produto <= 2),
  nota_localizacao SMALLINT CHECK (nota_localizacao >= -2 AND nota_localizacao <= 2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(processo_id, listing_casa_id, catalogo_casa_id)
);

ALTER TABLE public.batalhas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Frank batalhas" ON public.batalhas;
CREATE POLICY "Frank batalhas" ON public.batalhas FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_batalhas_processo ON public.batalhas(processo_id);
CREATE INDEX IF NOT EXISTS idx_batalhas_listing ON public.batalhas(listing_casa_id);
CREATE INDEX IF NOT EXISTS idx_batalhas_catalogo ON public.batalhas(catalogo_casa_id);
