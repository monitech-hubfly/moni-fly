-- 406: «Responsável da fase» como select Moní | Franqueado (não lista de usuários).
-- Converte itens usuario (404/405), garante em todas as fases ativas e migra respostas legadas.

UPDATE public.kanban_fase_checklist_itens
SET
  tipo = 'select',
  label = 'Responsável da fase',
  config_json = COALESCE(config_json, '{}'::jsonb)
    || '{"oculto_ui": true, "opcoes": ["Franqueado", "Moní"]}'::jsonb
WHERE campo_slug = 'responsavel_da_fase';

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
WHERE COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id
      AND i.campo_slug = 'responsavel_da_fase'
  );

-- Copia respostas do legado responsavel_da_fase_tipo (403) quando o campo canonico ainda esta vazio
INSERT INTO public.kanban_fase_checklist_respostas (item_id, card_id, valor, preenchido_em)
SELECT
  i_can.id,
  r.card_id,
  r.valor,
  COALESCE(r.preenchido_em, now())
FROM public.kanban_fase_checklist_respostas r
JOIN public.kanban_fase_checklist_itens i_tipo
  ON i_tipo.id = r.item_id
 AND i_tipo.campo_slug = 'responsavel_da_fase_tipo'
JOIN public.kanban_fase_checklist_itens i_can
  ON i_can.fase_id = i_tipo.fase_id
 AND i_can.campo_slug = 'responsavel_da_fase'
WHERE trim(COALESCE(r.valor, '')) IN ('Franqueado', 'Moní')
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_respostas r2
    WHERE r2.item_id = i_can.id
      AND r2.card_id = r.card_id
      AND trim(COALESCE(r2.valor, '')) <> ''
  )
ON CONFLICT (item_id, card_id) DO NOTHING;

-- Remove respostas UUID (modelo usuario da 404) para permitir preenchimento Moni/Franqueado
DELETE FROM public.kanban_fase_checklist_respostas r
USING public.kanban_fase_checklist_itens i
WHERE r.item_id = i.id
  AND i.campo_slug = 'responsavel_da_fase'
  AND r.valor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE public.kanban_fase_checklist_itens
SET config_json = COALESCE(config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb
WHERE campo_slug IN ('responsavel_da_fase_tipo', 'responsavel_da_fase_usuario');

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('406', 'responsavel_da_fase_select_moni_franqueado')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
