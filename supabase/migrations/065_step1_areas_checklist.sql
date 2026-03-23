CREATE TABLE IF NOT EXISTS public.processo_step1_area_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  area_nome TEXT NOT NULL,
  area_ordem INT NOT NULL DEFAULT 0,
  etapa_nome TEXT NOT NULL,
  concluido BOOLEAN NOT NULL DEFAULT FALSE,
  link_url TEXT,
  storage_path TEXT,
  nome_original TEXT,
  ativo_na_rede BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT processo_step1_area_checklist_unique UNIQUE (processo_id, area_nome, etapa_nome)
);

CREATE INDEX IF NOT EXISTS idx_step1_area_checklist_processo
  ON public.processo_step1_area_checklist (processo_id);

CREATE INDEX IF NOT EXISTS idx_step1_area_checklist_processo_area
  ON public.processo_step1_area_checklist (processo_id, area_nome, area_ordem);

ALTER TABLE public.processo_step1_area_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processo_step1_area_checklist_all"
  ON public.processo_step1_area_checklist
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_step1_area_checklist.processo_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

