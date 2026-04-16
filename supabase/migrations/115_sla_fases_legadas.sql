UPDATE public.kanban_fases
SET sla_dias = 7
WHERE kanban_id IN (
  SELECT id FROM public.kanbans
  WHERE nome IN ('Funil Portfólio', 'Funil Operações', 'Funil Contabilidade', 'Funil Crédito')
)
AND sla_dias IS NULL;
