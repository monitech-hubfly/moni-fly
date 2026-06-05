-- 264 part 07: slug temporário → definitivo (1 linha)
UPDATE public.kanban_fases
SET slug = 'capital_materiais_projeto'
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = '_tmp_capital_ativo';
