-- 263 portfolio part 03: step_3
UPDATE public.kanban_fases kf
SET nome = 'Opção', sla_dias = 3
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Portfólio'
  AND kf.slug = 'step_3';
