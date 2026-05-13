-- Etapa 2: condomínios do processo (venda casa >5MM) + checklist 16 itens

CREATE TABLE IF NOT EXISTS public.processo_condominios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 1,
  checklist_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_condominios_processo ON public.processo_condominios(processo_id);

-- RLS: Frank só acessa condomínios dos próprios processos
ALTER TABLE public.processo_condominios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Frank processo_condominios" ON public.processo_condominios;
CREATE POLICY "Frank processo_condominios" ON public.processo_condominios FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));
