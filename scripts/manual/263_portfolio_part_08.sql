-- 263 portfolio part 08: step_7
UPDATE public.kanban_fases kf
SET nome = 'Contrato', sla_dias = 3
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Portfólio'
  AND kf.slug = 'step_7';
