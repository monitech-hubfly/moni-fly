-- 512: Funil Loteadores — checklists das fases novas (esteira v1.0).
-- Idempotente.

DO $$
DECLARE
  v_kanban_id UUID := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  v_fase_id UUID;
  v_item_id UUID;
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id FROM public.kanbans
    WHERE nome IN ('Funil Loteadores', 'Funil Moní INC') LIMIT 1;
  END IF;
  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '512: kanban não encontrado';
    RETURN;
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      -- fase_slug, ordem, label, tipo, campo_slug
      ('nda_moni_inc'::text, 1, 'Data de envio do NDA'::text, 'data'::text, 'nda_data_envio'::text),
      ('nda_moni_inc', 2, 'Data de assinatura', 'data', 'nda_data_assinatura'),
      ('nda_moni_inc', 3, 'Arquivo do NDA assinado', 'url', 'nda_arquivo'),
      ('opcao_moni_inc', 1, 'Lote selecionado e opcionado', 'texto_curto', 'opcao_lote'),
      ('opcao_moni_inc', 2, 'Data da opção', 'data', 'opcao_data'),
      ('opcao_moni_inc', 3, 'Documento de opção', 'url', 'opcao_documento'),
      ('aguardando_ficha_moni_inc', 1, 'Ficha recebida (mínimo necessário)', 'checkbox', 'ficha_recebida'),
      ('aguardando_ficha_moni_inc', 2, 'Pendências da ficha', 'texto_longo', 'ficha_pendencias'),
      ('aguardando_ficha_moni_inc', 3, 'Cadastro do loteador', 'rede_loteador', 'rede_loteador'),
      ('validacao_moni_inc', 1, 'Data de validação', 'data', 'validacao_data'),
      ('validacao_moni_inc', 2, 'Feedbacks / ajustes solicitados', 'texto_longo', 'validacao_feedbacks'),
      ('acoplamento_gbox_moni_inc', 1, 'Link do acoplamento', 'url', 'link_acoplamento'),
      ('acoplamento_gbox_moni_inc', 2, 'Link Gbox', 'url', 'link_gbox'),
      ('revisoes_pos_comite_moni_inc', 1, 'Ajustes realizados', 'texto_longo', 'revisoes_pos_ajustes'),
      ('revisoes_pos_comite_moni_inc', 2, 'Versão pós-Comitê', 'url', 'revisoes_pos_versao'),
      ('revisoes_pos_comite_moni_inc', 3, 'Validado após revisões', 'checkbox', 'revisoes_pos_validado'),
      ('cto_precedentes_moni_inc', 1, 'Data da assinatura', 'data', 'precedentes_data_assinatura'),
      ('cto_precedentes_moni_inc', 2, 'Contrato', 'url', 'precedentes_contrato'),
      ('cto_precedentes_moni_inc', 3, 'Motivo da Assinatura de Cto com Precedentes', 'texto_longo', 'precedentes_motivo'),
      ('cto_showroom_moni_inc', 1, 'Data de assinatura', 'data', 'showroom_data_assinatura'),
      ('cto_showroom_moni_inc', 2, 'Arquivo do contrato assinado', 'url', 'showroom_contrato'),
      ('passagem_waysers_moni_inc', 1, 'Briefing completo preparado', 'texto_longo', 'waysers_briefing'),
      ('comite_moni_inc', 1, 'Apresentação para Comitê', 'url', 'apresentacao_comite'),
      ('comite_moni_inc', 2, 'Data da deliberação', 'data', 'comite_data_deliberacao'),
      ('comite_moni_inc', 3, 'Decisão do Comitê', 'select', 'comite_decisao'),
      ('comite_moni_inc', 4, 'Ressalvas / pontos de atenção', 'texto_longo', 'comite_ressalvas'),
      ('comite_moni_inc', 5, 'Membros presentes', 'texto_curto', 'comite_membros'),
      ('execucao_material_moni_inc', 10, 'PPT criado', 'url', 'ppt_criado'),
      ('contrato_parceria_moni_inc', 1, 'Data de assinatura', 'data', 'parceria_data_assinatura'),
      ('contrato_parceria_moni_inc', 2, 'Arquivo do contrato assinado', 'url', 'parceria_contrato')
    ) AS t(fase_slug, ordem, label, tipo, campo_slug)
  LOOP
    SELECT id INTO v_fase_id
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = r.fase_slug
    LIMIT 1;
    IF v_fase_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = r.campo_slug
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = r.ordem, label = r.label, tipo = r.tipo,
          visivel_candidato = true,
          config_json = CASE
            WHEN r.campo_slug = 'comite_decisao' THEN jsonb_build_object(
              'opcoes', jsonb_build_array('Aprovado', 'Aprovado com ressalvas', 'Reprovado')
            )
            ELSE COALESCE(config_json, '{}'::jsonb) - 'oculto_ui'
          END
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, r.ordem, r.label, r.tipo, false, true, r.campo_slug,
        CASE
          WHEN r.campo_slug = 'comite_decisao' THEN jsonb_build_object(
            'opcoes', jsonb_build_array('Aprovado', 'Aprovado com ressalvas', 'Reprovado')
          )
          ELSE '{}'::jsonb
        END
      );
    END IF;
  END LOOP;

  UPDATE public.kanban_fases
  SET instrucoes = 'Esta fase gera um card filho no Funil de Acoplamento. Finalize Acoplamento + Gbox antes do Comitê.'
  WHERE kanban_id = v_kanban_id AND slug = 'acoplamento_gbox_moni_inc';

  RAISE NOTICE '512: checklists Loteadores v1.0 ok';
END $$;

NOTIFY pgrst, 'reload schema';
