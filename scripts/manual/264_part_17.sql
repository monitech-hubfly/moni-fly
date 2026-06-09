-- 264 part 17: nome, ordem e SLA — capital_concluido
UPDATE public.kanban_fases
SET nome = 'Concluído', ordem = 7, sla_dias = NULL
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_concluido';
