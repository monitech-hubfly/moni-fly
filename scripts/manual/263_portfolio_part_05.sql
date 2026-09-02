-- 263 portfolio part 05: acoplamento
UPDATE public.kanban_fases kf
SET nome = 'Acoplamento', sla_dias = 5
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Portfólio'
  AND kf.slug = 'acoplamento';
