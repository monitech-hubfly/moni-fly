-- 264 part 15: nome, ordem e SLA — capital_informacoes_obrigatorias
UPDATE public.kanban_fases
SET nome = 'Informações obrigatórias para subir a oferta', ordem = 5, sla_dias = 5
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní Capital' LIMIT 1)
  AND slug = 'capital_informacoes_obrigatorias';
