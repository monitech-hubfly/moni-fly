-- 263 portfolio part 01: step_2
UPDATE public.kanban_fases kf
SET nome = 'Novo Negócio', sla_dias = 2
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Portfólio'
  AND kf.slug = 'step_2';
