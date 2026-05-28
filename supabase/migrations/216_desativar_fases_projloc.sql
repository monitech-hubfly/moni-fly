-- 216: desativa fases legadas projloc_* no Funil Projetos Locais (PROD kanban c2ab09bd-…)
-- Não deleta — só ativo = false para não quebrar cards já nessas fases.

UPDATE public.kanban_fases
SET ativo = false
WHERE kanban_id = 'c2ab09bd-4bd6-491e-8734-281d7678a6ad'
  AND slug IN (
    'projloc_briefing',
    'projloc_estudo',
    'projloc_ante',
    'projloc_aprovacao_condo',
    'projloc_executivo',
    'projloc_concluido'
  );
