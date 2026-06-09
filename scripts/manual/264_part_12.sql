-- 264 part 12: nome, ordem e SLA — capital_abertura_spe
UPDATE public.kanban_fases
SET nome = 'Abertura da SPE', ordem = 2, sla_dias = 10
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_abertura_spe';
