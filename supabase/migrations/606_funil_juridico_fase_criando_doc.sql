-- 606: Funil Jurídico — fase Criando Doc logo após Análise Inicial.
-- Não move cards. Idempotente. UUID canônico: KANBAN_IDS.JURIDICO.
-- SLA: 1 dia útil, igual às fases vizinhas de trabalho interno.

DO $$
DECLARE
  v_kanban_id uuid := '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid;
  r record;
  v_ord int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome = 'Funil Jurídico'
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '606: Funil Jurídico não encontrado — pulando.';
    RETURN;
  END IF;

  INSERT INTO public.kanban_fases (
    id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
  )
  SELECT
    'a7c3e1d4-6b20-4f8a-9c15-2d8e4f6a1b03'::uuid,
    v_kanban_id,
    'Criando Doc',
    'juridico_criando_doc',
    90,
    1,
    'uteis',
    false,
    true,
    'Elaborar o documento jurídico a partir da análise inicial.',
    '[]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND slug = 'juridico_criando_doc'
  );

  UPDATE public.kanban_fases
  SET
    nome = 'Criando Doc',
    sla_dias = 1,
    sla_tipo = 'uteis',
    fase_conversao = false,
    ativo = true,
    instrucoes = 'Elaborar o documento jurídico a partir da análise inicial.'
  WHERE kanban_id = v_kanban_id
    AND slug = 'juridico_criando_doc';

  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id
    FROM (
      VALUES
        (1, 'juridico_recebimento'),
        (2, 'juridico_analise_inicial'),
        (3, 'juridico_criando_doc'),
        (4, 'juridico_alteracoes_respostas'),
        (5, 'juridico_enviado_parceiro'),
        (6, 'juridico_subir_assinatura'),
        (7, 'juridico_aguardando_assinaturas'),
        (8, 'juridico_pos_assinatura'),
        (9, 'juridico_atendimentos_concluidos')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf
      ON kf.kanban_id = v_kanban_id
     AND kf.slug = t.slug
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases
    SET ordem = v_ord, ativo = true
    WHERE id = r.id;
  END LOOP;

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
    AND f.slug = 'juridico_criando_doc'
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
    AND f.slug = 'juridico_criando_doc'
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = f.id
        AND i.campo_slug = 'responsavel_da_fase'
    );
END $$;

-- Backfill nos cards abertos: responsável do card (Isabela) e da fase (Moní).
WITH alvos_card AS (
  SELECT
    c.id AS card_id,
    i.id AS item_id,
    p.id::text AS user_id
  FROM public.kanban_cards c
  INNER JOIN public.kanbans k ON k.id = c.kanban_id
  INNER JOIN public.kanban_fases f
    ON f.kanban_id = k.id
   AND f.slug = 'juridico_criando_doc'
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

WITH alvos_fase AS (
  SELECT
    c.id AS card_id,
    i.id AS item_id
  FROM public.kanban_cards c
  INNER JOIN public.kanbans k ON k.id = c.kanban_id
  INNER JOIN public.kanban_fases f
    ON f.kanban_id = k.id
   AND f.slug = 'juridico_criando_doc'
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
VALUES ('606', 'funil_juridico_fase_criando_doc')
ON CONFLICT (version) DO NOTHING;
