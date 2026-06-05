-- 264 part 14: nome, ordem e SLA — capital_materiais_projeto
UPDATE public.kanban_fases
SET nome = 'Materiais do projeto', ordem = 4, sla_dias = 10
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_materiais_projeto';
