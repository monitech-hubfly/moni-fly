-- 670: Funil Showroom (IMOB).
-- Fases e checklists copiados do Funil Portfólio. Não cria vínculo entre os dois funis.
-- Não move cards. Idempotente.

DO $$
DECLARE
  v_showroom uuid := 'e7b1c4d2-8a30-4f91-9c62-5d3a8e1b4f06'::uuid;
  v_portfolio uuid := 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid;
  v_juridico uuid := '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_portfolio) THEN
    SELECT id INTO v_portfolio
    FROM public.kanbans
    WHERE nome = 'Funil Portfólio'
    ORDER BY id
    LIMIT 1;
  END IF;

  INSERT INTO public.kanbans (id, nome, descricao, ativo)
  SELECT
    v_showroom,
    'Funil Showroom',
    'IMOB — Showroom. Campos das fases espelhados do Funil Portfólio, sem vínculo com ele.',
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanbans k
    WHERE k.id = v_showroom OR k.nome = 'Funil Showroom'
  );

  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_showroom) THEN
    SELECT id INTO v_showroom
    FROM public.kanbans
    WHERE nome = 'Funil Showroom'
    LIMIT 1;
  END IF;

  IF v_showroom IS NULL THEN
    RAISE NOTICE '670: Funil Showroom não encontrado — pulando.';
    RETURN;
  END IF;

  INSERT INTO public.kanban_fases (
    kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
  )
  SELECT
    v_showroom,
    m.nome,
    m.slug,
    m.ordem,
    src.sla_dias,
    COALESCE(src.sla_tipo, 'uteis'),
    false,
    true,
    src.instrucoes,
    COALESCE(src.materiais, '[]'::jsonb)
  FROM (
    VALUES
      (1,  'Hipótese',                    'sr_hipotese',                    'step_2'),
      (2,  'Pré Comitê',                  'sr_pre_comite',                  'pre_comite'),
      (3,  'Revisão de Hipótese',         'sr_revisao_hipotese',            'revisao_hipotese'),
      (4,  'Acoplamento',                 'sr_acoplamento',                 'acoplamento'),
      (5,  'Comitê',                      'sr_comite',                      'step_5'),
      (6,  'Revisões Comitê',             'sr_revisoes_comite',             'revisoes_comite'),
      (7,  'Demais Comitês',              'sr_demais_comites',              'segundo_comite'),
      (8,  'Iniciar Diligência',          'sr_iniciar_diligencia',          'step_6'),
      (9,  'Enviar Cto Showroom',         'sr_enviar_cto_showroom',         'cto_condicoes_precedentes'),
      (10, 'Jurídico Cto Showroom',       'sr_juridico_cto_showroom',       'juridico_cto_precedentes'),
      (11, 'Assinaturas Cto Showroom',    'sr_assinaturas_cto_showroom',    'assinaturas_cto_precedentes'),
      (12, 'Cto Showroom Assinado',       'sr_cto_showroom_assinado',       'cto_precedentes_assinado'),
      (13, 'Passagem p/ Wayser',          'sr_passagem_wayser',             'passagem_wayser'),
      (14, 'Convertidos',                 'sr_convertidos',                 'convertidos'),
      (15, 'Atualizar Material',          'sr_atualizar_material',          'atualizacao_material'),
      (16, 'Material em atualização',     'sr_material_em_atualizacao',     'material_em_atualizacao'),
      (17, 'Comitê Alvará',               'sr_comite_alvara',               'comite_alvara'),
      (18, 'Revisões Comitê Alvará',      'sr_revisoes_comite_alvara',      'revisoes_comite_alvara'),
      (19, 'Demais Comitês Alvará',       'sr_demais_comites_alvara',       'demais_comites_alvara'),
      (20, 'Enviar Termo Recompra',       'sr_enviar_termo_recompra',       'enviar_termo_recompra'),
      (21, 'Jurídico Termo Recompra',     'sr_juridico_termo_recompra',     'juridico_termo_recompra'),
      (22, 'Assinaturas Termo Recompra',  'sr_assinaturas_termo_recompra',  'assinaturas_termo_recompra'),
      (23, 'Termo Recompra Assinado',     'sr_termo_recompra_assinado',     'termo_recompra_assinado'),
      (24, 'Concluídos',                  'sr_concluidos',                  'portfolio_concluidos')
  ) AS m(ordem, nome, slug, src_slug)
  LEFT JOIN public.kanban_fases src
    ON src.kanban_id = v_portfolio
   AND src.slug = m.src_slug
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases f
    WHERE f.kanban_id = v_showroom
      AND f.slug = m.slug
  );

  UPDATE public.kanban_fases f
  SET
    nome = m.nome,
    ordem = m.ordem,
    ativo = true,
    sla_dias = src.sla_dias,
    sla_tipo = COALESCE(src.sla_tipo, f.sla_tipo, 'uteis'),
    instrucoes = COALESCE(src.instrucoes, f.instrucoes),
    materiais = COALESCE(src.materiais, f.materiais, '[]'::jsonb)
  FROM (
    VALUES
      (1,  'Hipótese',                    'sr_hipotese',                    'step_2'),
      (2,  'Pré Comitê',                  'sr_pre_comite',                  'pre_comite'),
      (3,  'Revisão de Hipótese',         'sr_revisao_hipotese',            'revisao_hipotese'),
      (4,  'Acoplamento',                 'sr_acoplamento',                 'acoplamento'),
      (5,  'Comitê',                      'sr_comite',                      'step_5'),
      (6,  'Revisões Comitê',             'sr_revisoes_comite',             'revisoes_comite'),
      (7,  'Demais Comitês',              'sr_demais_comites',              'segundo_comite'),
      (8,  'Iniciar Diligência',          'sr_iniciar_diligencia',          'step_6'),
      (9,  'Enviar Cto Showroom',         'sr_enviar_cto_showroom',         'cto_condicoes_precedentes'),
      (10, 'Jurídico Cto Showroom',       'sr_juridico_cto_showroom',       'juridico_cto_precedentes'),
      (11, 'Assinaturas Cto Showroom',    'sr_assinaturas_cto_showroom',    'assinaturas_cto_precedentes'),
      (12, 'Cto Showroom Assinado',       'sr_cto_showroom_assinado',       'cto_precedentes_assinado'),
      (13, 'Passagem p/ Wayser',          'sr_passagem_wayser',             'passagem_wayser'),
      (14, 'Convertidos',                 'sr_convertidos',                 'convertidos'),
      (15, 'Atualizar Material',          'sr_atualizar_material',          'atualizacao_material'),
      (16, 'Material em atualização',     'sr_material_em_atualizacao',     'material_em_atualizacao'),
      (17, 'Comitê Alvará',               'sr_comite_alvara',               'comite_alvara'),
      (18, 'Revisões Comitê Alvará',      'sr_revisoes_comite_alvara',      'revisoes_comite_alvara'),
      (19, 'Demais Comitês Alvará',       'sr_demais_comites_alvara',       'demais_comites_alvara'),
      (20, 'Enviar Termo Recompra',       'sr_enviar_termo_recompra',       'enviar_termo_recompra'),
      (21, 'Jurídico Termo Recompra',     'sr_juridico_termo_recompra',     'juridico_termo_recompra'),
      (22, 'Assinaturas Termo Recompra',  'sr_assinaturas_termo_recompra',  'assinaturas_termo_recompra'),
      (23, 'Termo Recompra Assinado',     'sr_termo_recompra_assinado',     'termo_recompra_assinado'),
      (24, 'Concluídos',                  'sr_concluidos',                  'portfolio_concluidos')
  ) AS m(ordem, nome, slug, src_slug)
  LEFT JOIN public.kanban_fases src
    ON src.kanban_id = v_portfolio
   AND src.slug = m.src_slug
  WHERE f.kanban_id = v_showroom
    AND f.slug = m.slug;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato,
    template_storage_path, placeholder, campo_slug, config_json,
    chave_compartilhada, grupo_exclusivo
  )
  SELECT
    dest.id,
    i.ordem,
    i.label,
    i.tipo,
    i.obrigatorio,
    i.visivel_candidato,
    i.template_storage_path,
    i.placeholder,
    i.campo_slug,
    COALESCE(i.config_json, '{}'::jsonb),
    i.chave_compartilhada,
    i.grupo_exclusivo
  FROM (
    VALUES
      ('sr_hipotese',                   'step_2'),
      ('sr_pre_comite',                 'pre_comite'),
      ('sr_revisao_hipotese',           'revisao_hipotese'),
      ('sr_acoplamento',                'acoplamento'),
      ('sr_comite',                     'step_5'),
      ('sr_revisoes_comite',            'revisoes_comite'),
      ('sr_demais_comites',             'segundo_comite'),
      ('sr_iniciar_diligencia',         'step_6'),
      ('sr_enviar_cto_showroom',        'cto_condicoes_precedentes'),
      ('sr_juridico_cto_showroom',      'juridico_cto_precedentes'),
      ('sr_assinaturas_cto_showroom',   'assinaturas_cto_precedentes'),
      ('sr_cto_showroom_assinado',      'cto_precedentes_assinado'),
      ('sr_passagem_wayser',            'passagem_wayser'),
      ('sr_convertidos',                'convertidos'),
      ('sr_atualizar_material',         'atualizacao_material'),
      ('sr_material_em_atualizacao',    'material_em_atualizacao'),
      ('sr_comite_alvara',              'comite_alvara'),
      ('sr_revisoes_comite_alvara',     'revisoes_comite_alvara'),
      ('sr_demais_comites_alvara',      'demais_comites_alvara'),
      ('sr_enviar_termo_recompra',      'enviar_termo_recompra'),
      ('sr_juridico_termo_recompra',    'juridico_termo_recompra'),
      ('sr_assinaturas_termo_recompra', 'assinaturas_termo_recompra'),
      ('sr_termo_recompra_assinado',    'termo_recompra_assinado'),
      ('sr_concluidos',                 'portfolio_concluidos')
  ) AS m(slug, src_slug)
  JOIN public.kanban_fases src
    ON src.kanban_id = v_portfolio
   AND src.slug = m.src_slug
  JOIN public.kanban_fases dest
    ON dest.kanban_id = v_showroom
   AND dest.slug = m.slug
  JOIN public.kanban_fase_checklist_itens i
    ON i.fase_id = src.id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens d
    WHERE d.fase_id = dest.id
      AND d.label = i.label
      AND d.ordem = i.ordem
      AND d.campo_slug IS NOT DISTINCT FROM i.campo_slug
  );

  IF EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_juridico) THEN
    INSERT INTO public.kanban_tags (kanban_id, nome, cor)
    SELECT v_juridico, t.nome, t.cor
    FROM (
      VALUES
        ('Cto Showroom', '#2f4a3a'),
        ('Termo Recompra Showroom', '#D4AD68')
    ) AS t(nome, cor)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.kanban_tags kt
      WHERE kt.kanban_id = v_juridico
        AND kt.nome = t.nome
    );
  END IF;
END $$;

ALTER TABLE public.kanban_cards
  DROP CONSTRAINT IF EXISTS kanban_cards_juridico_tipo_contrato_check;

ALTER TABLE public.kanban_cards
  ADD CONSTRAINT kanban_cards_juridico_tipo_contrato_check
  CHECK (
    juridico_tipo_contrato IS NULL
    OR juridico_tipo_contrato IN (
      'opcao',
      'cto_com_precedentes',
      'cto_sem_precedentes',
      'termo_recompra',
      'nda',
      'parceria',
      'franquia',
      'cof',
      'aditivo',
      'documento_padrao',
      'demais',
      'showroom',
      'cto_showroom',
      'termo_recompra_showroom'
    )
  );

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('670', 'funil_showroom')
ON CONFLICT (version) DO NOTHING;
