-- Classificação do sub-chamado (paridade com formulário kanban / Sirene Chamados).

ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'atividade';

UPDATE public.sirene_topicos
SET tipo = 'atividade'
WHERE tipo IS NULL OR tipo NOT IN ('atividade', 'duvida', 'chamado');

ALTER TABLE public.sirene_topicos
  ALTER COLUMN tipo SET DEFAULT 'atividade',
  ALTER COLUMN tipo SET NOT NULL;

ALTER TABLE public.sirene_topicos DROP CONSTRAINT IF EXISTS sirene_topicos_tipo_check;
ALTER TABLE public.sirene_topicos
  ADD CONSTRAINT sirene_topicos_tipo_check
  CHECK (tipo IN ('atividade', 'duvida', 'chamado'));

COMMENT ON COLUMN public.sirene_topicos.tipo IS
  'Sub-chamado: atividade | duvida | chamado (UI alinhada ao kanban).';

NOTIFY pgrst, 'reload schema';
