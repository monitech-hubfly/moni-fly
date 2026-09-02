-- 403: Campo «Responsável da fase» (Franqueado | Moní) em todas as fases ativas.
-- Exibido no painel lateral do modal; oculto no checklist central (oculto_ui).

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
  'Responsável da fase — tipo',
  'select',
  false,
  false,
  'responsavel_da_fase_tipo',
  '{"oculto_ui": true, "opcoes": ["Franqueado", "Moní"]}'::jsonb
FROM public.kanban_fases f
WHERE COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id
      AND i.campo_slug = 'responsavel_da_fase_tipo'
  );

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
  -1,
  'Responsável da fase — usuário Moní',
  'usuario',
  false,
  false,
  'responsavel_da_fase_usuario',
  '{"oculto_ui": true}'::jsonb
FROM public.kanban_fases f
WHERE COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id
      AND i.campo_slug = 'responsavel_da_fase_usuario'
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('403', 'responsavel_da_fase_franqueado_moni')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
