-- 264 part 13: nome, ordem e SLA — capital_cadastro_plataforma
UPDATE public.kanban_fases
SET nome = 'Cadastro na plataforma', ordem = 3, sla_dias = 3
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_cadastro_plataforma';
