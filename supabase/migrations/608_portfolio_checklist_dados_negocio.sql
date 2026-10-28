-- 608: Funil Portfólio — campos de Dados do Negócio nas fases, espelhados na lateral do card.
-- Chave compartilhada negocio:<coluna> (ou negocio:prazo_opcao / negocio:prazo_instrumento_garantidor).
-- Idempotente.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS pct_compra_parcial_terreno NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS pct_vgv_terrenista         NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS m2_terreno                  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS m2_casa                     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS extrato_modelo_configurado  TEXT,
  ADD COLUMN IF NOT EXISTS data_aprovacao_comite       DATE,
  ADD COLUMN IF NOT EXISTS obs_opcao                   TEXT,
  ADD COLUMN IF NOT EXISTS data_ass_opcao_terreno      DATE,
  ADD COLUMN IF NOT EXISTS obs_instrumento_garantidor  TEXT,
  ADD COLUMN IF NOT EXISTS data_ass_contrato_terreno   DATE,
  ADD COLUMN IF NOT EXISTS valor_recompra             TEXT;

DO $$
DECLARE
  v_kanban uuid := 'c57120a0-991c-422b-8def-4d16a9411d45';
  v_tipo jsonb := '[
    "Permuta Parcial",
    "100% Permuta",
    "100% Permuta + % do VGV",
    "100% Compra e Venda Moní",
    "100% Compra e Venda",
    "Prestação de Serviços de Arquitetura e Construção"
  ]'::jsonb;
  v_produto jsonb := '[
    "Moní Gal™","Moní Cissa™","Moní Eva™","Moní Ivy™","Moní Lena™","Moní Liz™",
    "Moní Mia™","Moní Sol™","Moní Gal L™","Moní Cissa L™","Moní Val™","Moní Lu™",
    "Moní Isa™","Moní Duda™","Moní Ale™"
  ]'::jsonb;
  v_estudo text[] := ARRAY[
    'step_2','aprovacao_moni_novo_negocio','revisao_hipotese','pre_comite','step_4',
    'acoplamento','enviar_acoplamento_frank','revisoes_pre_comite','step_5',
    'revisoes_comite','segundo_comite'
  ];
  v_tipo_fases text[] := ARRAY[
    'step_2','aprovacao_moni_novo_negocio','revisao_hipotese','pre_comite',
    'revisoes_pre_comite','step_5','revisoes_comite','segundo_comite'
  ];
  v_drive text[] := ARRAY[
    'step_2','aprovacao_moni_novo_negocio','revisao_hipotese','pre_comite',
    'revisoes_pre_comite','step_5'
  ];
  v_comite text[] := ARRAY['step_5','revisoes_comite','segundo_comite'];
  v_acop text[] := ARRAY[
    'acoplamento','enviar_acoplamento_frank','revisoes_pre_comite','step_5',
    'revisoes_comite','segundo_comite'
  ];
  v_contratos text[] := ARRAY['step_3','cto_condicoes_precedentes','step_7'];
  v_obrig_estudo text[] := ARRAY['revisoes_pre_comite','step_5','revisoes_comite','segundo_comite'];
  v_num jsonb := '{"step":"0.01","decimal":true}'::jsonb;
  v_m2 jsonb := '{"step":"0.01","decimal":true,"sufixo":"m²"}'::jsonb;
  v_pct_parcial jsonb;
  v_pct_vgv jsonb;
  v_divida jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban) THEN
    RAISE NOTICE '608: Funil Portfólio não encontrado — seed ignorado.';
    RETURN;
  END IF;

  v_pct_parcial := v_num || jsonb_build_object(
    'sufixo', '%',
    'visible_when', jsonb_build_object('campo_slug', 'tipo_aquisicao_terreno', 'valor', 'Permuta Parcial')
  );
  v_pct_vgv := v_num || jsonb_build_object(
    'sufixo', '%',
    'visible_when', jsonb_build_object('campo_slug', 'tipo_aquisicao_terreno', 'valor', '100% Permuta + % do VGV')
  );
  v_divida := jsonb_build_object(
    'visible_when', jsonb_build_object(
      'campo_slug', 'tipo_aquisicao_terreno',
      'valores', jsonb_build_array('Permuta Parcial', '100% Compra e Venda Moní', '100% Compra e Venda')
    )
  );

  CREATE TEMP TABLE _neg (
    fase_slug text,
    campo_slug text,
    label text,
    tipo text,
    obrigatorio boolean,
    ordem int,
    config_json jsonb
  ) ON COMMIT DROP;

  INSERT INTO _neg
  SELECT slug, 'tipo_aquisicao_terreno', 'Tipo de negócio', 'select',
         slug = ANY (v_obrig_estudo), 10, jsonb_build_object('opcoes', v_tipo)
  FROM unnest(v_tipo_fases) AS slug;

  INSERT INTO _neg
  SELECT slug, 'link_pasta_drive', 'Pasta do Drive', 'url',
         slug = 'revisoes_pre_comite', 11, '{}'::jsonb
  FROM unnest(v_drive) AS slug;

  INSERT INTO _neg
  SELECT slug, 'valor_terreno', 'Valor do Terreno', 'moeda', true, 12, '{}'::jsonb
  FROM unnest(v_comite) AS slug;

  INSERT INTO _neg
  SELECT slug, 'pct_compra_parcial_terreno', '% Compra Parcial Terreno', 'numero', true, 13, v_pct_parcial
  FROM unnest(v_comite) AS slug;

  INSERT INTO _neg
  SELECT slug, 'pct_vgv_terrenista', '% VGV Terrenista', 'numero', true, 14, v_pct_vgv
  FROM unnest(v_comite) AS slug;

  INSERT INTO _neg
  SELECT slug, 'divida_terreno', 'Dívida Terreno', 'moeda', true, 15, v_divida
  FROM unnest(v_comite) AS slug;

  INSERT INTO _neg
  SELECT slug, 'm2_terreno', 'M² Terreno', 'numero', true, 16, v_m2
  FROM unnest(v_comite) AS slug;

  INSERT INTO _neg
  SELECT slug, 'link_opcao_permuta', 'Contratos', 'url', true, 17, '{}'::jsonb
  FROM unnest(v_contratos) AS slug;

  INSERT INTO _neg
  SELECT slug, 'prazo_opcao', 'Prazo Opção', 'texto_longo', true, 18,
         '{"widget":"negocio_prazo","prazo":"prazo_opcao"}'::jsonb
  FROM unnest(ARRAY['opcao_assinada']) AS slug;

  INSERT INTO _neg
  SELECT slug, 'obs_opcao', 'Obs. Opção', 'texto_longo', true, 19, '{}'::jsonb
  FROM unnest(ARRAY['opcao_assinada']) AS slug;

  INSERT INTO _neg
  SELECT slug, 'data_ass_opcao_terreno', 'Data Ass. Opção Terreno', 'data', true, 20, '{}'::jsonb
  FROM unnest(ARRAY['opcao_assinada']) AS slug;

  INSERT INTO _neg
  SELECT slug, 'produto_modelo_casa', 'Produto / Modelo', 'select',
         slug = ANY (v_obrig_estudo), 21, jsonb_build_object('opcoes', v_produto)
  FROM unnest(v_estudo) AS slug;

  INSERT INTO _neg
  SELECT slug, 'extrato_modelo_configurado', 'Extrato Modelo Configurado', 'url',
         slug = ANY (v_obrig_estudo), 22, '{}'::jsonb
  FROM unnest(v_estudo) AS slug;

  INSERT INTO _neg
  SELECT slug, 'm2_casa', 'M² Casa', 'numero',
         slug = ANY (v_obrig_estudo), 23, v_m2
  FROM unnest(v_estudo) AS slug;

  INSERT INTO _neg
  SELECT slug, 'custo_obra', 'Custo da Obra', 'moeda',
         slug = ANY (v_obrig_estudo), 24, '{}'::jsonb
  FROM unnest(v_estudo) AS slug;

  INSERT INTO _neg
  SELECT slug, 'divida_obra', 'Dívida Obra', 'moeda',
         slug = ANY (v_obrig_estudo), 25, '{}'::jsonb
  FROM unnest(v_estudo) AS slug;

  INSERT INTO _neg
  SELECT slug, 'link_bca', 'BCA', 'url',
         slug = ANY (v_obrig_estudo), 26, '{}'::jsonb
  FROM unnest(v_estudo) AS slug;

  INSERT INTO _neg
  SELECT slug, 'link_mapa_competidores', 'Mapa de Competidores', 'url',
         slug = ANY (v_obrig_estudo), 27, '{}'::jsonb
  FROM unnest(v_estudo) AS slug;

  INSERT INTO _neg
  SELECT slug, 'vgv_pretendido', 'VGV pretendido', 'moeda',
         slug = ANY (v_obrig_estudo), 28, '{}'::jsonb
  FROM unnest(v_estudo) AS slug;

  INSERT INTO _neg
  SELECT slug, 'valor_recompra', 'Valor Recompra', 'moeda', true, 29, '{}'::jsonb
  FROM unnest(v_comite) AS slug;

  INSERT INTO _neg
  SELECT slug, 'link_acoplamento', 'Acoplamento', 'url', true, 30, '{}'::jsonb
  FROM unnest(v_acop) AS slug;

  INSERT INTO _neg
  SELECT slug, 'link_gbox', 'GBOX', 'url', true, 31, '{}'::jsonb
  FROM unnest(v_acop) AS slug;

  INSERT INTO _neg
  SELECT slug, 'link_apresentacao_comite', 'Apresentação Comitê', 'url',
         slug = ANY (v_obrig_estudo), 32, '{}'::jsonb
  FROM unnest(v_estudo) AS slug;

  INSERT INTO _neg
  SELECT slug, 'data_aprovacao_comite', 'Data Aprovação Comitê', 'data', true, 33, '{}'::jsonb
  FROM unnest(v_comite) AS slug;

  INSERT INTO _neg
  SELECT slug, 'prazo_instrumento_garantidor', 'Prazo Instrumento Garantidor', 'texto_longo', true, 34,
         '{"widget":"negocio_prazo","prazo":"prazo_instrumento_garantidor"}'::jsonb
  FROM unnest(v_comite) AS slug;

  INSERT INTO _neg
  SELECT slug, 'obs_instrumento_garantidor', 'Obs. Instrumento Garantidor', 'texto_longo', true, 35, '{}'::jsonb
  FROM unnest(v_comite) AS slug;

  INSERT INTO _neg
  SELECT slug, 'data_ass_contrato_terreno', 'Data Ass. Contrato Terreno', 'data', true, 36, '{}'::jsonb
  FROM unnest(v_comite) AS slug;

  UPDATE public.kanban_fase_checklist_itens i
  SET label = n.label,
      tipo = n.tipo,
      obrigatorio = n.obrigatorio,
      config_json = n.config_json,
      chave_compartilhada = 'negocio:' || n.campo_slug,
      visivel_candidato = false
  FROM _neg n
  JOIN public.kanban_fases kf
    ON kf.kanban_id = v_kanban
   AND kf.slug = n.fase_slug
  WHERE i.fase_id = kf.id
    AND i.campo_slug = n.campo_slug;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, chave_compartilhada
  )
  SELECT kf.id, n.ordem, n.label, n.tipo, n.obrigatorio, false, n.campo_slug, n.config_json,
         'negocio:' || n.campo_slug
  FROM _neg n
  JOIN public.kanban_fases kf
    ON kf.kanban_id = v_kanban
   AND kf.slug = n.fase_slug
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = kf.id
      AND i.campo_slug = n.campo_slug
  );
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('608', 'portfolio_checklist_dados_negocio')
ON CONFLICT (version) DO NOTHING;
