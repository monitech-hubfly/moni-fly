-- 264 part 03: slug legado → temporário (1 linha)
UPDATE public.kanban_fases
SET slug = '_tmp_capital_estruturacao'
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_estruturacao';
