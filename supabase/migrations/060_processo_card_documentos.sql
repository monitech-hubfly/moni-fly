-- Documentos por card (Painel Novos Negócios)

CREATE TABLE IF NOT EXISTS public.processo_card_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  etapa_painel TEXT NOT NULL,
  titulo TEXT NOT NULL,
  storage_path TEXT,
  nome_original TEXT,
  link_url TEXT,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_card_documentos_processo ON public.processo_card_documentos(processo_id);
CREATE INDEX IF NOT EXISTS idx_processo_card_documentos_etapa ON public.processo_card_documentos(processo_id, etapa_painel);

ALTER TABLE public.processo_card_documentos ENABLE ROW LEVEL SECURITY;

-- Permitir editar documentos do card conforme donos/consultor da carteira (mesma regra de processo_card_checklist)
CREATE POLICY "processo_card_documentos_all"
  ON public.processo_card_documentos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_documentos.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );

