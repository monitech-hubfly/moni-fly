-- Conferência APÓS 264
SELECT kf.slug, kf.nome, kf.ordem, kf.sla_dias,
       left(coalesce(kf.instrucoes, ''), 40) AS instrucoes_preview
FROM public.kanban_fases kf
JOIN public.kanbans k ON k.id = kf.kanban_id
WHERE k.nome = 'Funil Moní Capital'
ORDER BY kf.ordem;
