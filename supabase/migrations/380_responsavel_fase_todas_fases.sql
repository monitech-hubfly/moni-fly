-- 380: Campo «Responsável da fase» (tipo usuario) em todas as fases ativas de todos os kanbans.

INSERT INTO public.kanban_fase_checklist_itens (
  fase_id,
  ordem,
  label,
  tipo,
  obrigatorio,
  visivel_candidato,
  campo_slug,
  config_json
)
SELECT
  f.id,
  0,
  'Responsável da fase',
  'usuario',
  false,
  true,
  'responsavel_fase',
  '{}'::jsonb
FROM public.kanban_fases f
WHERE COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id
      AND i.campo_slug = 'responsavel_fase'
  );

COMMENT ON COLUMN public.kanban_fase_checklist_itens.campo_slug IS
  'Identificador estável do campo. responsavel_fase = responsável do card nesta fase (propaga da fase anterior).';
