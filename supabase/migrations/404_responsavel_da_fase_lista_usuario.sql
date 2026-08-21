-- 404: «Responsável da fase» como campo usuario (lista), igual ao responsável do card.
-- Substitui o modelo Franqueado/Moní da migration 403 no painel lateral.

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

-- Garantir oculto_ui nos itens legados da 403
UPDATE public.kanban_fase_checklist_itens
SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb
WHERE campo_slug IN ('responsavel_da_fase_tipo', 'responsavel_da_fase_usuario');

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('404', 'responsavel_da_fase_lista_usuario')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
