-- 158: Kanban "Funil Moní INC" — cópia das fases do Funil Step One + checklist por fase.

INSERT INTO public.kanbans (nome, descricao, ordem, ativo)
SELECT 'Funil Moní INC', 'Funil de qualificação Moní INC', 1, true
WHERE NOT EXISTS (SELECT 1 FROM public.kanbans WHERE nome = 'Funil Moní INC');

INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
SELECT
  (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní INC' LIMIT 1),
  kf.nome,
  CASE
    WHEN kf.slug IS NOT NULL AND btrim(kf.slug::text) <> '' THEN btrim(kf.slug::text) || '_moni_inc'
    ELSE 'fase_' || kf.ordem::text || '_moni_inc'
  END,
  kf.ordem,
  kf.sla_dias,
  kf.ativo,
  kf.instrucoes,
  COALESCE(kf.materiais, '[]'::jsonb)
FROM public.kanban_fases kf
JOIN public.kanbans k ON k.id = kf.kanban_id
WHERE k.nome = 'Funil Step One'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases f2
    JOIN public.kanbans k2 ON k2.id = f2.kanban_id
    WHERE k2.nome = 'Funil Moní INC'
      AND f2.ordem = kf.ordem
  );

INSERT INTO public.kanban_fase_checklist_itens
  (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, template_storage_path, placeholder)
SELECT
  (
    SELECT f2.id
    FROM public.kanban_fases f2
    JOIN public.kanbans k2 ON k2.id = f2.kanban_id
    WHERE k2.nome = 'Funil Moní INC'
      AND f2.ordem = kf.ordem
    LIMIT 1
  ),
  ci.ordem,
  ci.label,
  ci.tipo,
  ci.obrigatorio,
  ci.visivel_candidato,
  ci.template_storage_path,
  ci.placeholder
FROM public.kanban_fase_checklist_itens ci
JOIN public.kanban_fases kf ON kf.id = ci.fase_id
JOIN public.kanbans k ON k.id = kf.kanban_id
WHERE k.nome = 'Funil Step One'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens ci2
    JOIN public.kanban_fases f2 ON f2.id = ci2.fase_id
    JOIN public.kanbans k2 ON k2.id = f2.kanban_id
    WHERE k2.nome = 'Funil Moní INC'
      AND ci2.label = ci.label
      AND f2.ordem = kf.ordem
  );
