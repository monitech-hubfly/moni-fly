-- Visibilidade do anexo para o franqueado. Default false: o que já existe continua oculto.

ALTER TABLE public.sirene_anexos
  ADD COLUMN IF NOT EXISTS visivel_franqueado BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.chamado_anexos
  ADD COLUMN IF NOT EXISTS visivel_franqueado BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sirene_anexos.visivel_franqueado IS
  'true = o franqueado pode ver este anexo do chamado Sirene.';

COMMENT ON COLUMN public.chamado_anexos.visivel_franqueado IS
  'true = o franqueado pode ver este anexo da atividade (kanban_atividades).';

NOTIFY pgrst, 'reload schema';
