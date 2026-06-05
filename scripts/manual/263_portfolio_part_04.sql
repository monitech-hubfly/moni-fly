-- 263 portfolio part 04: step_4
UPDATE public.kanban_fases kf
SET nome = 'Check Legal e Crédito', sla_dias = 3
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Portfólio'
  AND kf.slug = 'step_4';
