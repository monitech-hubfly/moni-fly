-- 529: «Responsável da fase» passa a incluir Loteador (Franqueado | Loteador | Moní).
-- Idempotente. Cobre fases novas (ex.: Marketing 528) sem o campo.

UPDATE public.kanban_fase_checklist_itens
SET
  tipo = 'select',
  label = 'Responsável da fase',
  config_json = COALESCE(config_json, '{}'::jsonb)
    || '{"oculto_ui": true, "opcoes": ["Franqueado", "Loteador", "Moní"]}'::jsonb
WHERE campo_slug = 'responsavel_da_fase';

UPDATE public.kanban_fase_checklist_itens
SET
  config_json = COALESCE(config_json, '{}'::jsonb)
    || '{"oculto_ui": true, "opcoes": ["Franqueado", "Loteador", "Moní"]}'::jsonb
WHERE campo_slug = 'responsavel_da_fase_tipo';

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
  'select',
  false,
  false,
  'responsavel_da_fase',
  '{"oculto_ui": true, "opcoes": ["Franqueado", "Loteador", "Moní"]}'::jsonb
FROM public.kanban_fases f
WHERE COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id
      AND i.campo_slug = 'responsavel_da_fase'
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('529', 'responsavel_da_fase_loteador')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
