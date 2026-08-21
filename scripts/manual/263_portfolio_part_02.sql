-- 263 portfolio part 02: aprovacao_moni_novo_negocio
UPDATE public.kanban_fases kf
SET nome = 'Aprovação Moní - Novo Negócio', sla_dias = 2
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Portfólio'
  AND kf.slug = 'aprovacao_moni_novo_negocio';
