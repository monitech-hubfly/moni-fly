-- 264 part 11: nome, ordem e SLA — capital_recebimento
UPDATE public.kanban_fases
SET nome = 'Recebimento', ordem = 1, sla_dias = 1
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_recebimento';
