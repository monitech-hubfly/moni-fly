-- 574: Funil Jurídico — garante «Responsável do card» e «Responsável da fase»
-- nas 8 fases canônicas (criadas depois das 380/406) e preenche o padrão.
-- Card: Isabela Correa. Fase: Moní.
-- Idempotente. UUID canônico: KANBAN_IDS.JURIDICO.

DO $$
DECLARE
  v_kanban_id uuid := '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome = 'Funil Jurídico'
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '574: Funil Jurídico não encontrado — pulando.';
    RETURN;
  END IF;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT
    f.id,
    0,
    'Responsável do card',
    'usuario',
    false,
    false,
    'responsavel_fase',
    '{"oculto_ui": true}'::jsonb
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_kanban_id
    AND COALESCE(f.ativo, true) = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = f.id
        AND i.campo_slug = 'responsavel_fase'
    );

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
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
  WHERE f.kanban_id = v_kanban_id
    AND COALESCE(f.ativo, true) = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = f.id
        AND i.campo_slug = 'responsavel_da_fase'
    );
END $$;

-- Backfill: responsável do card → Isabela Correa (todas as fases ativas do funil).
WITH alvos_card AS (
  SELECT
    c.id AS card_id,
    i.id AS item_id,
    p.id::text AS user_id
  FROM public.kanban_cards c
  INNER JOIN public.kanbans k ON k.id = c.kanban_id
  INNER JOIN public.kanban_fases f
    ON f.kanban_id = k.id
   AND COALESCE(f.ativo, true) = true
  INNER JOIN public.kanban_fase_checklist_itens i
    ON i.fase_id = f.id
   AND i.campo_slug = 'responsavel_fase'
  INNER JOIN public.profiles p
    ON lower(trim(p.email)) = lower('isabela.correa@moni.casa')
  WHERE (k.id = '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid OR k.nome = 'Funil Jurídico')
    AND COALESCE(c.arquivado, false) = false
)
INSERT INTO public.kanban_fase_checklist_respostas (
  item_id, card_id, valor, preenchido_em
)
SELECT a.item_id, a.card_id, a.user_id, NOW()
FROM alvos_card a
ON CONFLICT (item_id, card_id) DO UPDATE
SET
  valor = CASE
    WHEN btrim(COALESCE(kanban_fase_checklist_respostas.valor, '')) = '' THEN EXCLUDED.valor
    ELSE kanban_fase_checklist_respostas.valor
  END,
  preenchido_em = CASE
    WHEN btrim(COALESCE(kanban_fase_checklist_respostas.valor, '')) = '' THEN EXCLUDED.preenchido_em
    ELSE kanban_fase_checklist_respostas.preenchido_em
  END;

-- Backfill: responsável da fase → Moní (todas as fases ativas do funil).
WITH alvos_fase AS (
  SELECT
    c.id AS card_id,
    i.id AS item_id
  FROM public.kanban_cards c
  INNER JOIN public.kanbans k ON k.id = c.kanban_id
  INNER JOIN public.kanban_fases f
    ON f.kanban_id = k.id
   AND COALESCE(f.ativo, true) = true
  INNER JOIN public.kanban_fase_checklist_itens i
    ON i.fase_id = f.id
   AND i.campo_slug = 'responsavel_da_fase'
  WHERE (k.id = '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid OR k.nome = 'Funil Jurídico')
    AND COALESCE(c.arquivado, false) = false
)
INSERT INTO public.kanban_fase_checklist_respostas (
  item_id, card_id, valor, preenchido_em
)
SELECT a.item_id, a.card_id, 'Moní', NOW()
FROM alvos_fase a
ON CONFLICT (item_id, card_id) DO UPDATE
SET
  valor = CASE
    WHEN btrim(COALESCE(kanban_fase_checklist_respostas.valor, '')) = '' THEN EXCLUDED.valor
    ELSE kanban_fase_checklist_respostas.valor
  END,
  preenchido_em = CASE
    WHEN btrim(COALESCE(kanban_fase_checklist_respostas.valor, '')) = '' THEN EXCLUDED.preenchido_em
    ELSE kanban_fase_checklist_respostas.preenchido_em
  END;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('574', 'funil_juridico_responsaveis')
ON CONFLICT (version) DO NOTHING;
