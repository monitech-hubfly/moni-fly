-- 263 portfolio part 10: passagem_wayser
UPDATE public.kanban_fases kf
SET nome = 'Passagem para Wayser', sla_dias = 2
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Portfólio'
  AND kf.slug = 'passagem_wayser';
