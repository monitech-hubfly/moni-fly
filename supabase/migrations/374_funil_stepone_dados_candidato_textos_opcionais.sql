-- 374: Funil Step One — Dados do Candidato: textos longos opcionais (não bloqueiam avanço de fase).

UPDATE public.kanban_fase_checklist_itens i
SET obrigatorio = false
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id
WHERE i.fase_id = f.id
  AND k.nome = 'Funil Step One'
  AND f.slug IN ('dados_candidato', 'stepone_dados_candidato')
  AND i.label IN (
    'Experiências profissionais relevantes',
    'Trajetória e aprendizados mais importantes',
    'Por que acredita que seria um bom franqueado Moní'
  );
