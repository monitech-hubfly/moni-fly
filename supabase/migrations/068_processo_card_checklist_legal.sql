-- Checklist Legal (Step 4: Check Legal + Checklist de Crédito)
-- Persistência das respostas + anexos do checklist, com reaproveitamento por "nome_condominio".

CREATE TABLE IF NOT EXISTS public.processo_card_checklist_legal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  nome_condominio TEXT NOT NULL,
  respostas_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  arquivos_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  completo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_processo_card_checklist_legal_processo
  ON public.processo_card_checklist_legal (processo_id);

CREATE INDEX IF NOT EXISTS idx_processo_card_checklist_legal_condominio
  ON public.processo_card_checklist_legal (nome_condominio);

ALTER TABLE public.processo_card_checklist_legal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processo_card_checklist_legal_all"
  ON public.processo_card_checklist_legal
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_checklist_legal.processo_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

