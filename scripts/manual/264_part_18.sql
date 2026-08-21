-- 264 part 18: nome, ordem e SLA — capital_nao_elegivel
UPDATE public.kanban_fases
SET nome = 'Não elegível', ordem = 8, sla_dias = NULL
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_nao_elegivel';
