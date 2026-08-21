-- 382: Oculta «Responsável da fase» do checklist central (exibe só no painel lateral do modal).

UPDATE public.kanban_fase_checklist_itens
SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb
WHERE campo_slug = 'responsavel_fase'
   OR trim(label) = 'Responsável da fase';
