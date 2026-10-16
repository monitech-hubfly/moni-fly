-- 622: Portfólio divide Atualização material em Atualizar Material + Material em atualização.
-- Pré Obra e Obra ganha Comitê Ops Aprovado logo após Comitê Ops.
-- Não move cards. Idempotente.

DO $$
DECLARE
  v_portfolio uuid := 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid;
  v_operacoes uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid;
  v_material uuid := 'b8e1a00a-6d30-4f8a-9c15-2d8e4f6a1c0a'::uuid;
  v_comite uuid := 'b7c4e2a4-6d30-4f8a-9c15-2d8e4f6a1c14'::uuid;
  v_sla int;
  v_sla_tipo text;
  r record;
  v_ord int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_portfolio) THEN
    SELECT id INTO v_portfolio
    FROM public.kanbans
    WHERE nome = 'Funil Portfólio' AND COALESCE(ativo, true)
    ORDER BY id
    LIMIT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_operacoes) THEN
    SELECT id INTO v_operacoes
    FROM public.kanbans
    WHERE nome IN ('Funil Pré Obra e Obra', 'Funil Operações')
    ORDER BY CASE WHEN nome = 'Funil Pré Obra e Obra' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_portfolio IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET nome = 'Atualizar Material'
    WHERE kanban_id = v_portfolio
      AND slug = 'atualizacao_material'
      AND nome IS DISTINCT FROM 'Atualizar Material';

    INSERT INTO public.kanban_fases (
      id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, materiais
    )
    SELECT
      v_material,
      v_portfolio,
      'Material em atualização',
      'material_em_atualizacao',
      200,
      3,
      'uteis',
      false,
      true,
      '[]'::jsonb
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.kanban_fases f
      WHERE f.kanban_id = v_portfolio
        AND f.slug = 'material_em_atualizacao'
    );

    UPDATE public.kanban_fases
    SET
      nome = 'Material em atualização',
      sla_dias = 3,
      sla_tipo = 'uteis',
      fase_conversao = false,
      ativo = true
    WHERE kanban_id = v_portfolio
      AND slug = 'material_em_atualizacao';

    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    )
    SELECT f.id, 0, 'Responsável do card', 'usuario', false, false, 'responsavel_fase', '{"oculto_ui": true}'::jsonb
    FROM public.kanban_fases f
    WHERE f.kanban_id = v_portfolio
      AND f.slug = 'material_em_atualizacao'
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
    WHERE f.kanban_id = v_portfolio
      AND f.slug = 'material_em_atualizacao'
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
          (29, 'material_em_atualizacao'),
          (30, 'comite_alvara'),
          (31, 'revisoes_comite_alvara'),
          (32, 'demais_comites_alvara'),
          (33, 'enviar_termo_recompra'),
          (34, 'juridico_termo_recompra'),
          (35, 'assinaturas_termo_recompra'),
          (36, 'termo_recompra_assinado'),
          (37, 'portfolio_concluidos')
      ) AS t(ord_pref, slug)
      JOIN public.kanban_fases kf
        ON kf.kanban_id = v_portfolio
       AND kf.slug = t.slug
      ORDER BY t.ord_pref
    LOOP
      v_ord := v_ord + 1;
      UPDATE public.kanban_fases
      SET ordem = v_ord, ativo = true
      WHERE id = r.id;
    END LOOP;
  END IF;

  IF v_operacoes IS NOT NULL THEN
    SELECT f.sla_dias, f.sla_tipo
    INTO v_sla, v_sla_tipo
    FROM public.kanban_fases f
    WHERE f.kanban_id = v_operacoes
      AND f.slug = 'revisao_bca'
    LIMIT 1;

    INSERT INTO public.kanban_fases (
      id, kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, materiais
    )
    SELECT
      v_comite,
      v_operacoes,
      'Comitê Ops Aprovado',
      'comite_ops_aprovado',
      90,
      v_sla,
      COALESCE(v_sla_tipo, 'uteis'),
      false,
      true,
      '[]'::jsonb
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.kanban_fases f
      WHERE f.kanban_id = v_operacoes
        AND f.slug = 'comite_ops_aprovado'
    );

    UPDATE public.kanban_fases
    SET
      nome = 'Comitê Ops Aprovado',
      ativo = true,
      sla_tipo = COALESCE(sla_tipo, v_sla_tipo, 'uteis'),
      fase_conversao = false
    WHERE kanban_id = v_operacoes
      AND slug = 'comite_ops_aprovado';

    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
    )
    SELECT f.id, 0, 'Responsável do card', 'usuario', false, false, 'responsavel_fase', '{"oculto_ui": true}'::jsonb
    FROM public.kanban_fases f
    WHERE f.kanban_id = v_operacoes
      AND f.slug = 'comite_ops_aprovado'
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
    WHERE f.kanban_id = v_operacoes
      AND f.slug = 'comite_ops_aprovado'
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
          (1, 'planialtimetrico'),
          (2, 'projeto_legal'),
          (3, 'aprovacao_condominio'),
          (4, 'comunique_se_condominio'),
          (5, 'aprovacao_prefeitura'),
          (6, 'comunique_se_prefeitura'),
          (7, 'revisao_bca'),
          (8, 'comite_ops_aprovado'),
          (9, 'instrumento_garantidor'),
          (10, 'processos_cartorarios'),
          (11, 'aguardando_credito'),
          (12, 'em_obra'),
          (13, 'operacoes_entregue')
      ) AS t(ord_pref, slug)
      JOIN public.kanban_fases kf
        ON kf.kanban_id = v_operacoes
       AND kf.slug = t.slug
      ORDER BY t.ord_pref
    LOOP
      v_ord := v_ord + 1;
      UPDATE public.kanban_fases
      SET ordem = v_ord, ativo = true
      WHERE id = r.id;
    END LOOP;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('622', 'portfolio_material_comite_ops_aprovado')
ON CONFLICT (version) DO NOTHING;
