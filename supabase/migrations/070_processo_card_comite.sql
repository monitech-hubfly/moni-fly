-- Dados complementares do Comitê no card (Step 5)

CREATE TABLE IF NOT EXISTS public.processo_card_comite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  etapa_painel TEXT NOT NULL DEFAULT 'step_5',
  comite_moni_concluido BOOLEAN NOT NULL DEFAULT false,
  parecer_texto TEXT,
  link_url TEXT,
  storage_path TEXT,
  nome_original TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_processo_card_comite_processo
  ON public.processo_card_comite (processo_id);

ALTER TABLE public.processo_card_comite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processo_card_comite_all"
  ON public.processo_card_comite
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.processo_step_one p
      WHERE p.id = processo_card_comite.processo_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

