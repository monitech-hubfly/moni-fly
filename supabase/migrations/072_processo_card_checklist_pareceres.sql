-- Parecer textual opcional por item de checklist (ex.: Comunique-se)

CREATE TABLE IF NOT EXISTS public.processo_card_checklist_pareceres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID NOT NULL REFERENCES public.processo_card_checklist(id) ON DELETE CASCADE,
  texto TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_processo_card_checklist_pareceres_item
  ON public.processo_card_checklist_pareceres (checklist_item_id);

ALTER TABLE public.processo_card_checklist_pareceres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processo_card_checklist_pareceres_all"
  ON public.processo_card_checklist_pareceres
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.processo_card_checklist c
      JOIN public.processo_step_one p ON p.id = c.processo_id
      WHERE c.id = processo_card_checklist_pareceres.checklist_item_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

