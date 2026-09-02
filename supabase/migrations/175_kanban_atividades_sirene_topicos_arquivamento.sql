-- Arquivamento de interações (kanban_atividades) e sub-interações (sirene_topicos)

ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT;

COMMENT ON COLUMN public.kanban_atividades.arquivado IS 'Interação arquivada; oculta no modal até nova política de exibição.';

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_arquivado
  ON public.kanban_atividades (arquivado)
  WHERE arquivado = true;

ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT;

COMMENT ON COLUMN public.sirene_topicos.arquivado IS 'Sub-chamado arquivado; oculto nas listas ativas.';

CREATE INDEX IF NOT EXISTS idx_sirene_topicos_arquivado
  ON public.sirene_topicos (arquivado)
  WHERE arquivado = true;
