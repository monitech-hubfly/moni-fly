ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS interacao_id UUID REFERENCES public.kanban_atividades(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS times_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS responsaveis_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trava BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.sirene_topicos.interacao_id IS
  'Vínculo com kanban_atividades: tópico como sub-interação de uma interação do kanban.';
COMMENT ON COLUMN public.sirene_topicos.times_ids IS
  'Times UUID responsáveis pelo tópico (complementa time_responsavel texto).';
COMMENT ON COLUMN public.sirene_topicos.responsaveis_ids IS
  'Lista de responsáveis pelo tópico. Complementa/substitui responsavel_id singular.';

UPDATE public.sirene_topicos
SET responsaveis_ids = ARRAY[responsavel_id]
WHERE responsavel_id IS NOT NULL
  AND (responsaveis_ids IS NULL OR responsaveis_ids = '{}');

COMMENT ON COLUMN public.sirene_topicos.aprovado_bombeiro IS
  'DESATIVADO — fluxo de aprovação removido em migration 118. Ver docs/SIRENE_TOPICOS_APROVACAO_BACKUP.md';
COMMENT ON COLUMN public.sirene_topicos.motivo_reprovacao IS
  'DESATIVADO — fluxo de aprovação removido em migration 118. Ver docs/SIRENE_TOPICOS_APROVACAO_BACKUP.md';

CREATE INDEX IF NOT EXISTS idx_sirene_topicos_interacao
  ON public.sirene_topicos (interacao_id);

CREATE INDEX IF NOT EXISTS idx_sirene_topicos_responsaveis
  ON public.sirene_topicos USING GIN (responsaveis_ids);
