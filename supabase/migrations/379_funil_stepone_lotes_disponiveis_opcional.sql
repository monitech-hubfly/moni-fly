-- Lotes Disponíveis: item de checklist não obrigatório para avanço de fase.

UPDATE public.kanban_fase_checklist_itens i
SET obrigatorio = false
FROM public.kanban_fases f
WHERE i.fase_id = f.id
  AND f.slug IN ('lotes_disponiveis', 'stepone_lotes')
  AND i.tipo = 'lotes_condominio'
  AND i.obrigatorio IS DISTINCT FROM false;

UPDATE public.kanban_fase_checklist_itens i
SET obrigatorio = false
FROM public.kanban_fases f
WHERE i.fase_id = f.id
  AND f.slug IN ('lotes_disponiveis', 'stepone_lotes')
  AND trim(i.label) ILIKE 'Lotes por condom%nio prospectado%'
  AND i.obrigatorio IS DISTINCT FROM false;
