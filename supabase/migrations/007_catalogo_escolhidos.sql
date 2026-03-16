-- Troca: as "3 casas escolhidas" passam a ser 3 MODELOS DO CATÁLOGO Moní (não 3 casas ZAP).
-- Batalhas: todas as casas listadas na ZAP × os 3 modelos do catálogo escolhidos.

-- Remove a tabela antiga (escolha era de 3 casas ZAP)
DROP TABLE IF EXISTS public.casas_escolhidas;

-- Escolher 3 modelos do catálogo Moní para batalhar com as casas da ZAP (e para o BCA)
CREATE TABLE IF NOT EXISTS public.catalogo_escolhidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  catalogo_casa_id UUID NOT NULL REFERENCES public.catalogo_casas(id) ON DELETE CASCADE,
  ordem SMALLINT NOT NULL CHECK (ordem >= 1 AND ordem <= 3),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(processo_id, ordem),
  UNIQUE(processo_id, catalogo_casa_id)
);

ALTER TABLE public.catalogo_escolhidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Frank catalogo_escolhidos" ON public.catalogo_escolhidos;
CREATE POLICY "Frank catalogo_escolhidos" ON public.catalogo_escolhidos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_catalogo_escolhidos_processo ON public.catalogo_escolhidos(processo_id);
