-- 264 part 02: slug legado → temporário (1 linha)
UPDATE public.kanban_fases
SET slug = '_tmp_capital_elegibilidade'
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_elegibilidade';
