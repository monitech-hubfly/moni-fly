-- 518: Funil Loteadores — alinhar campo_slug dos checklists das fases novas (Prompt 7).
-- Renomeia slugs da 512 → nomes canônicos; remove checklist de Acoplamento+Gbox.
-- Idempotente.

DO $$
DECLARE
  v_kanban_id UUID := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  v_fase_id UUID;
  v_item_id UUID;
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    RAISE NOTICE '518: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  -- Renomear campo_slug legado → canônico (mesmo fase_id)
  FOR r IN
    SELECT * FROM (VALUES
      ('nda_moni_inc'::text, 'nda_data_envio'::text, 'data_envio_nda'::text),
      ('nda_moni_inc', 'nda_data_assinatura', 'data_assinatura_nda'),
      ('nda_moni_inc', 'nda_arquivo', 'arquivo_nda_assinado'),
      ('opcao_moni_inc', 'opcao_lote', 'lote_selecionado_opcionado'),
      ('opcao_moni_inc', 'opcao_data', 'data_opcao'),
      ('opcao_moni_inc', 'opcao_documento', 'documento_opcao'),
      ('validacao_moni_inc', 'validacao_data', 'data_validacao'),
      ('validacao_moni_inc', 'validacao_feedbacks', 'feedbacks_ajustes'),
      ('revisoes_pos_comite_moni_inc', 'revisoes_pos_ajustes', 'ajustes_realizados'),
      ('revisoes_pos_comite_moni_inc', 'revisoes_pos_versao', 'versao_pos_comite'),
      ('revisoes_pos_comite_moni_inc', 'revisoes_pos_validado', 'validado_apos_revisoes'),
      ('cto_precedentes_moni_inc', 'precedentes_data_assinatura', 'data_assinatura_cto_precedentes'),
      ('cto_precedentes_moni_inc', 'precedentes_contrato', 'contrato_precedentes'),
      ('cto_precedentes_moni_inc', 'precedentes_motivo', 'motivo_assinatura_precedentes'),
      ('passagem_waysers_moni_inc', 'waysers_briefing', 'briefing_completo_preparado')
    ) AS t(fase_slug, slug_old, slug_new)
  LOOP
    SELECT id INTO v_fase_id
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = r.fase_slug
    LIMIT 1;
    IF v_fase_id IS NULL THEN CONTINUE; END IF;

    -- Se o canônico já existe, só oculta o legado
    IF EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND campo_slug = r.slug_new
    ) THEN
      UPDATE public.kanban_fase_checklist_itens
      SET config_json = COALESCE(config_json, '{}'::jsonb) || jsonb_build_object('oculto_ui', true)
      WHERE fase_id = v_fase_id AND campo_slug = r.slug_old;
    ELSE
      UPDATE public.kanban_fase_checklist_itens
      SET campo_slug = r.slug_new
      WHERE fase_id = v_fase_id AND campo_slug = r.slug_old;
    END IF;
  END LOOP;

  -- Garantir itens canônicos (upsert por campo_slug)
  FOR r IN
    SELECT * FROM (VALUES
      ('nda_moni_inc'::text, 1, 'Data de envio do NDA'::text, 'data'::text, 'data_envio_nda'::text),
      ('nda_moni_inc', 2, 'Data de assinatura do NDA', 'data', 'data_assinatura_nda'),
      ('nda_moni_inc', 3, 'Arquivo do NDA assinado', 'url', 'arquivo_nda_assinado'),
      ('opcao_moni_inc', 1, 'Lote selecionado e opcionado', 'texto_curto', 'lote_selecionado_opcionado'),
      ('opcao_moni_inc', 2, 'Data da opção', 'data', 'data_opcao'),
      ('opcao_moni_inc', 3, 'Documento de opção', 'url', 'documento_opcao'),
      ('aguardando_ficha_moni_inc', 1, 'Nome do condomínio', 'texto_curto', 'nome_condominio'),
      ('aguardando_ficha_moni_inc', 2, 'Cidade', 'texto_curto', 'cidade'),
      ('aguardando_ficha_moni_inc', 3, 'Qtd. de lotes', 'texto_curto', 'qtd_lotes'),
      ('aguardando_ficha_moni_inc', 4, 'Preço dos lotes', 'texto_curto', 'preco_lotes'),
      ('aguardando_ficha_moni_inc', 5, 'Metragem dos lotes', 'texto_curto', 'metragem_lotes'),
      ('aguardando_ficha_moni_inc', 6, 'Planta cadastral', 'url', 'planta_cadastral'),
      ('validacao_moni_inc', 1, 'Data de validação', 'data', 'data_validacao'),
      ('validacao_moni_inc', 2, 'Feedbacks / ajustes', 'texto_longo', 'feedbacks_ajustes'),
      ('revisoes_pos_comite_moni_inc', 1, 'Ajustes realizados', 'texto_longo', 'ajustes_realizados'),
      ('revisoes_pos_comite_moni_inc', 2, 'Versão pós-Comitê', 'url', 'versao_pos_comite'),
      ('revisoes_pos_comite_moni_inc', 3, 'Validado após revisões', 'checkbox', 'validado_apos_revisoes'),
      ('cto_precedentes_moni_inc', 1, 'Data da assinatura', 'data', 'data_assinatura_cto_precedentes'),
      ('cto_precedentes_moni_inc', 2, 'Contrato com precedentes', 'url', 'contrato_precedentes'),
      ('cto_precedentes_moni_inc', 3, 'Motivo da assinatura com precedentes', 'texto_longo', 'motivo_assinatura_precedentes'),
      ('passagem_waysers_moni_inc', 1, 'Briefing completo preparado', 'texto_longo', 'briefing_completo_preparado')
    ) AS t(fase_slug, ordem, label, tipo, campo_slug)
  LOOP
    SELECT id INTO v_fase_id
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = r.fase_slug
    LIMIT 1;
    IF v_fase_id IS NULL THEN CONTINUE; END IF;

    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = r.campo_slug
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = r.ordem, label = r.label, tipo = r.tipo,
          visivel_candidato = true,
          config_json = COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, r.ordem, r.label, r.tipo, false, true, r.campo_slug, '{}'::jsonb
      );
    END IF;
  END LOOP;

  -- Acoplamento + Gbox: sem checklist — ocultar itens e reforçar instrução
  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'acoplamento_gbox_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NOT NULL THEN
    UPDATE public.kanban_fase_checklist_itens
    SET config_json = COALESCE(config_json, '{}'::jsonb) || jsonb_build_object('oculto_ui', true)
    WHERE fase_id = v_fase_id;
    UPDATE public.kanban_fases
    SET instrucoes = 'Esta fase gera um card filho no Funil de Acoplamento (modelagem do terreno). Finalize Acoplamento + Gbox antes do Comitê.'
    WHERE id = v_fase_id;
  END IF;

  RAISE NOTICE '518: checklists Prompt 7 alinhados.';
END $$;

NOTIFY pgrst, 'reload schema';
