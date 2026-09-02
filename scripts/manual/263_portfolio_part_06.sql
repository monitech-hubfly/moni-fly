-- 263 portfolio part 06: step_5
UPDATE public.kanban_fases kf
SET nome = 'Comitê', sla_dias = 5
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Portfólio'
  AND kf.slug = 'step_5';
