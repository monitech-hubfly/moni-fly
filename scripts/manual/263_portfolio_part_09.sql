-- 263 portfolio part 09: captacao_moni_capital
UPDATE public.kanban_fases kf
SET nome = 'Captação Moní Capital', sla_dias = 30
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Portfólio'
  AND kf.slug = 'captacao_moni_capital';
