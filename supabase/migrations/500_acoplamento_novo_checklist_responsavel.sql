-- 500: Funil Acoplamento — «Responsável do card» e «Responsável da fase» nas fases
-- criadas após migrations 380/406 (ex.: Novo Acoplamento / Aguardando Comitê).

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
  'Responsável do card',
  'usuario',
  false,
  true,
  'responsavel_fase',
  '{"oculto_ui": true}'::jsonb
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
WHERE (k.id = '15847602-231d-4937-a06f-82027eb87ef3'::uuid OR k.nome = 'Funil Acoplamento')
  AND f.slug IN ('novo_acoplamento', 'aguardando_comite_acoplamento')
  AND COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id
      AND i.campo_slug = 'responsavel_fase'
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
  -2,
  'Responsável da fase',
  'select',
  false,
  false,
  'responsavel_da_fase',
  '{"oculto_ui": true, "opcoes": ["Franqueado", "Moní"]}'::jsonb
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
WHERE (k.id = '15847602-231d-4937-a06f-82027eb87ef3'::uuid OR k.nome = 'Funil Acoplamento')
  AND f.slug IN ('novo_acoplamento', 'aguardando_comite_acoplamento')
  AND COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id
      AND i.campo_slug = 'responsavel_da_fase'
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('500', 'acoplamento_novo_checklist_responsavel')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
