-- Mapa interativo da praça: visualização informativa, não obrigatória para avanço de fase.

UPDATE public.kanban_fase_checklist_itens i
SET obrigatorio = false
FROM public.kanban_fases f
WHERE i.fase_id = f.id
  AND f.slug IN ('dados_cidade', 'stepone_dados_cidade')
  AND i.tipo = 'mapa_praca'
  AND i.obrigatorio IS DISTINCT FROM false;

UPDATE public.kanban_fase_checklist_itens i
SET obrigatorio = false
FROM public.kanban_fases f
WHERE i.fase_id = f.id
  AND f.slug IN ('dados_cidade', 'stepone_dados_cidade')
  AND trim(i.label) ILIKE 'Mapa interativo da pra%'
  AND i.obrigatorio IS DISTINCT FROM false;
