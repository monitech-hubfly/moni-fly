-- Escolher 3 casas (da Etapa 4) para usar nas Batalhas e no BCA — exatamente 3 por processo
CREATE TABLE IF NOT EXISTS public.casas_escolhidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  listing_casa_id UUID NOT NULL REFERENCES public.listings_casas(id) ON DELETE CASCADE,
  ordem SMALLINT NOT NULL CHECK (ordem >= 1 AND ordem <= 3),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(processo_id, ordem),
  UNIQUE(processo_id, listing_casa_id)
);

ALTER TABLE public.casas_escolhidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Frank casas_escolhidas" ON public.casas_escolhidas FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_casas_escolhidas_processo ON public.casas_escolhidas(processo_id);
