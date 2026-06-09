-- 263 portfolio part 07: step_6
UPDATE public.kanban_fases kf
SET nome = 'Diligência', sla_dias = 10
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Portfólio'
  AND kf.slug = 'step_6';
