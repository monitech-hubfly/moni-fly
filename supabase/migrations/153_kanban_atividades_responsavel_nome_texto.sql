-- Nome do responsável em texto (catálogo Moní / externo) quando não há match em profiles.
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS responsavel_nome_texto TEXT;

COMMENT ON COLUMN public.kanban_atividades.responsavel_nome_texto IS
  'Responsável por nome (ex.: catálogo TIMES_MONI) quando responsaveis_ids não resolve para perfil.';
