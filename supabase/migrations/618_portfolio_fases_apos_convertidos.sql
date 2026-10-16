-- 618: Funil Portfólio — fases depois de Convertidos.
-- Não são conclusão, exceto Concluídos. Não move cards. Idempotente.

DO $$
DECLARE
  v_kanban uuid := 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid;
  r record;
  v_ord int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban) THEN
    SELECT id INTO v_kanban
    FROM public.kanbans
    WHERE nome = 'Funil Portfólio' AND COALESCE(ativo, true)
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban IS NULL THEN
    RAISE NOTICE '618: Funil Portfólio não encontrado — pulando.';
    RETURN;
  END IF;

  INSERT INTO public.kanban_fases (
    id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, materiais
  )
  SELECT
    v.id,
    v_kanban,
    v.nome,
    v.slug,
    200,
    v.sla_dias,
    'uteis',
    false,
    true,
    '[]'::jsonb
  FROM (
    VALUES
      ('b8e1a001-6d30-4f8a-9c15-2d8e4f6a1c01'::uuid, 'Atualização material', 'atualizacao_material', 3),
      ('b8e1a002-6d30-4f8a-9c15-2d8e4f6a1c02'::uuid, 'Comitê Alvará', 'comite_alvara', 3),
      ('b8e1a003-6d30-4f8a-9c15-2d8e4f6a1c03'::uuid, 'Revisões Comitê Alvará', 'revisoes_comite_alvara', 2),
      ('b8e1a004-6d30-4f8a-9c15-2d8e4f6a1c04'::uuid, 'Demais Comitês Alvará', 'demais_comites_alvara', 3),
      ('b8e1a005-6d30-4f8a-9c15-2d8e4f6a1c05'::uuid, 'Enviar Termo Recompra', 'enviar_termo_recompra', 1),
      ('b8e1a006-6d30-4f8a-9c15-2d8e4f6a1c06'::uuid, 'Jurídico Termo Recompra', 'juridico_termo_recompra', 3),
      ('b8e1a007-6d30-4f8a-9c15-2d8e4f6a1c07'::uuid, 'Assinaturas Termo Recompra', 'assinaturas_termo_recompra', 3),
      ('b8e1a008-6d30-4f8a-9c15-2d8e4f6a1c08'::uuid, 'Termo Recompra Assinado', 'termo_recompra_assinado', 1),
      ('b8e1a009-6d30-4f8a-9c15-2d8e4f6a1c09'::uuid, 'Concluídos', 'portfolio_concluidos', NULL::int)
  ) AS v(id, nome, slug, sla_dias)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases f
    WHERE f.kanban_id = v_kanban
      AND f.slug = v.slug
  );

  UPDATE public.kanban_fases f
  SET
    nome = v.nome,
    sla_dias = v.sla_dias,
    sla_tipo = 'uteis',
    fase_conversao = false,
    ativo = true
  FROM (
    VALUES
      ('atualizacao_material', 'Atualização material', 3),
      ('comite_alvara', 'Comitê Alvará', 3),
      ('revisoes_comite_alvara', 'Revisões Comitê Alvará', 2),
      ('demais_comites_alvara', 'Demais Comitês Alvará', 3),
      ('enviar_termo_recompra', 'Enviar Termo Recompra', 1),
      ('juridico_termo_recompra', 'Jurídico Termo Recompra', 3),
      ('assinaturas_termo_recompra', 'Assinaturas Termo Recompra', 3),
      ('termo_recompra_assinado', 'Termo Recompra Assinado', 1),
      ('portfolio_concluidos', 'Concluídos', NULL::int)
  ) AS v(slug, nome, sla_dias)
  WHERE f.kanban_id = v_kanban
    AND f.slug = v.slug;

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
  WHERE f.kanban_id = v_kanban
    AND f.slug IN (
      'atualizacao_material',
      'comite_alvara',
      'revisoes_comite_alvara',
      'demais_comites_alvara',
      'enviar_termo_recompra',
      'juridico_termo_recompra',
      'assinaturas_termo_recompra',
      'termo_recompra_assinado',
      'portfolio_concluidos'
    )
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
  WHERE f.kanban_id = v_kanban
    AND f.slug IN (
      'atualizacao_material',
      'comite_alvara',
      'revisoes_comite_alvara',
      'demais_comites_alvara',
      'enviar_termo_recompra',
      'juridico_termo_recompra',
      'assinaturas_termo_recompra',
      'termo_recompra_assinado',
      'portfolio_concluidos'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = f.id
        AND i.campo_slug = 'responsavel_da_fase'
    );

  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id
    FROM (
      VALUES
        (1, 'step_2'),
        (2, 'aprovacao_moni_novo_negocio'),
        (3, 'revisao_hipotese'),
        (4, 'pre_comite'),
        (5, 'revisoes_pre_comite'),
        (6, 'step_3'),
        (7, 'juridico_opcao'),
        (8, 'assinaturas_opcao'),
        (9, 'opcao_assinada'),
        (10, 'step_4'),
        (11, 'acoplamento'),
        (12, 'enviar_acoplamento_frank'),
        (13, 'step_5'),
        (14, 'revisoes_comite'),
        (15, 'segundo_comite'),
        (16, 'cto_condicoes_precedentes'),
        (17, 'juridico_cto_precedentes'),
        (18, 'assinaturas_cto_precedentes'),
        (19, 'cto_precedentes_assinado'),
        (20, 'iniciar_abertura_empresas'),
        (21, 'step_6'),
        (22, 'step_7'),
        (23, 'juridico_contrato'),
        (24, 'assinaturas_contrato'),
        (25, 'contrato_s_precedentes_assinado'),
        (26, 'passagem_wayser'),
        (27, 'convertidos'),
        (28, 'atualizacao_material'),
        (29, 'comite_alvara'),
        (30, 'revisoes_comite_alvara'),
        (31, 'demais_comites_alvara'),
        (32, 'enviar_termo_recompra'),
        (33, 'juridico_termo_recompra'),
        (34, 'assinaturas_termo_recompra'),
        (35, 'termo_recompra_assinado'),
        (36, 'portfolio_concluidos')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf
      ON kf.kanban_id = v_kanban
     AND kf.slug = t.slug
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases
    SET ordem = v_ord, ativo = true
    WHERE id = r.id;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('618', 'portfolio_fases_apos_convertidos')
ON CONFLICT (version) DO NOTHING;
