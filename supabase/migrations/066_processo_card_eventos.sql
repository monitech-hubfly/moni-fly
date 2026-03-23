-- Histórico de ações do card (checklists/anexos + movimentações), para render no CardDetalheModal

CREATE TABLE IF NOT EXISTS public.processo_card_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_nome TEXT,
  etapa_painel TEXT,
  tipo TEXT NOT NULL,
  descricao TEXT,
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_card_eventos_processo ON public.processo_card_eventos(processo_id);
CREATE INDEX IF NOT EXISTS idx_processo_card_eventos_created ON public.processo_card_eventos(created_at);

ALTER TABLE public.processo_card_eventos ENABLE ROW LEVEL SECURITY;

-- SELECT/INSERT: mesma regra de acesso do painel (dono, consultor da carteira, admin)
CREATE POLICY "processo_card_eventos_select" ON public.processo_card_eventos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_eventos.processo_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

CREATE POLICY "processo_card_eventos_insert" ON public.processo_card_eventos
  FOR INSERT
  WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_eventos.processo_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

