-- 264 part 16: nome, ordem e SLA — capital_formalizacao
UPDATE public.kanban_fases
SET nome = 'Formalização', ordem = 6, sla_dias = 5
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_formalizacao';
