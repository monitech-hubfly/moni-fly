-- 405: Garante campo «Responsável da fase» (slug responsavel_da_fase) em TODAS as fases ativas.
-- Idempotente: cobre ambientes sem 404, fases criadas depois e label corrompida pela 402.

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
  -2,
  'Responsável da fase',
  'usuario',
  false,
  false,
  'responsavel_da_fase',
  '{"oculto_ui": true}'::jsonb
FROM public.kanban_fases f
WHERE COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id
      AND i.campo_slug = 'responsavel_da_fase'
  );

UPDATE public.kanban_fase_checklist_itens
SET label = 'Responsável da fase'
WHERE campo_slug = 'responsavel_da_fase'
  AND trim(label) <> 'Responsável da fase';

UPDATE public.kanban_fase_checklist_itens
SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb
WHERE campo_slug = 'responsavel_da_fase';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('405', 'responsavel_da_fase_todas_fases_ativas')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
