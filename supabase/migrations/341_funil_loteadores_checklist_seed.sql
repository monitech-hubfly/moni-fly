-- 341: Funil Loteadores — seed de checklist por fase (idempotente por fase + campo_slug).

-- 341: Funil Loteadores — seed de checklist por fase (idempotente por fase + campo_slug).
-- Resolve fase Viabilidade em viabilidade_moni_inc OU dados_loteador_moni_inc (reaproveitamento).

CREATE OR REPLACE FUNCTION public._resolve_loteador_fase_id(
  p_kanban_id UUID,
  p_slugs TEXT[]
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_fase_id UUID;
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  WHERE f.kanban_id = p_kanban_id
    AND f.slug = ANY(p_slugs)
    AND COALESCE(f.ativo, true) = true
  ORDER BY
    CASE f.slug
      WHEN 'viabilidade_moni_inc' THEN 0
      WHEN 'dados_loteador_moni_inc' THEN 1
      ELSE 2
    END,
    f.ordem NULLS LAST
  LIMIT 1;

  RETURN v_fase_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._seed_loteador_checklist_item(
  p_fase_slug TEXT,
  p_ordem INT,
  p_label TEXT,
  p_tipo TEXT,
  p_campo_slug TEXT,
  p_obrigatorio BOOLEAN DEFAULT false,
  p_config JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
  v_slugs TEXT[];
BEGIN
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome = 'Funil Loteadores'
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN RETURN; END IF;

  IF p_fase_slug = 'viabilidade_moni_inc' THEN
    v_slugs := ARRAY['viabilidade_moni_inc', 'dados_loteador_moni_inc'];
    v_fase_id := public._resolve_loteador_fase_id(v_kanban_id, v_slugs);
  ELSE
    v_fase_id := public._resolve_loteador_fase_id(v_kanban_id, ARRAY[p_fase_slug]);
  END IF;

  IF v_fase_id IS NULL THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = p_campo_slug
  ) THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = p_ordem, label = p_label, tipo = p_tipo, obrigatorio = p_obrigatorio, config_json = p_config
    WHERE fase_id = v_fase_id AND campo_slug = p_campo_slug;
    RETURN;
  END IF;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  ) VALUES (
    v_fase_id, p_ordem, p_label, p_tipo, p_obrigatorio, true, p_campo_slug, p_config
  );
END;
$$;

DO $$
BEGIN
  -- Fase 1: Primeiro Contato
  PERFORM public._seed_loteador_checklist_item('primeiro_contato_moni_inc', 10, 'Descrição do primeiro contato', 'texto_longo', 'primeiro_contato_descricao');
  PERFORM public._seed_loteador_checklist_item('primeiro_contato_moni_inc', 11, 'Responsável pelo contato', 'usuario', 'responsavel_contato');
  PERFORM public._seed_loteador_checklist_item(
    'primeiro_contato_moni_inc', 12, 'Canal de contato', 'select', 'canal_contato', false,
    '{"opcoes":["WhatsApp","Ligação","E-mail","Presencial","Outro"]}'::jsonb
  );
  PERFORM public._seed_loteador_checklist_item('primeiro_contato_moni_inc', 13, 'Data da reunião', 'data', 'data_reuniao');
  PERFORM public._seed_loteador_checklist_item('primeiro_contato_moni_inc', 14, 'Horário da reunião', 'hora', 'horario_reuniao');
  PERFORM public._seed_loteador_checklist_item('primeiro_contato_moni_inc', 15, 'Participantes previstos', 'texto_longo', 'participantes_previstos');
  PERFORM public._seed_loteador_checklist_item('primeiro_contato_moni_inc', 16, 'Observações da reunião', 'texto_longo', 'observacoes_reuniao');

  -- Fase 2: R1 — score automático
  PERFORM public._seed_loteador_checklist_item(
    'r1_conceito_moni_inc', 10, 'Preço — atratividade', 'select', 'preco_atratividade', false,
    '{"opcoes":["Atrativo","Não atrativo","Não expôs"]}'::jsonb
  );
  PERFORM public._seed_loteador_checklist_item(
    'r1_conceito_moni_inc', 11, 'Produto — atratividade', 'select', 'produto_atratividade', false,
    '{"opcoes":["Atrativo","Algumas alterações","Não atrativo","Não expôs"]}'::jsonb
  );
  PERFORM public._seed_loteador_checklist_item(
    'r1_conceito_moni_inc', 12, 'Showroom — interesse', 'select', 'showroom_interesse', false,
    '{"opcoes":["Sim","Não","Não expôs"]}'::jsonb
  );
  PERFORM public._seed_loteador_checklist_item('r1_conceito_moni_inc', 13, 'Showroom — descrição', 'texto_longo', 'showroom_descricao');
  PERFORM public._seed_loteador_checklist_item('r1_conceito_moni_inc', 14, 'Linhas de receita', 'texto_longo', 'linhas_receita');
  PERFORM public._seed_loteador_checklist_item('r1_conceito_moni_inc', 15, 'Casa que vende', 'texto_longo', 'casa_que_vende');
  PERFORM public._seed_loteador_checklist_item('r1_conceito_moni_inc', 16, 'Restrições', 'texto_longo', 'restricoes');
  PERFORM public._seed_loteador_checklist_item('r1_conceito_moni_inc', 17, 'Oportunidades', 'texto_longo', 'oportunidades');
  PERFORM public._seed_loteador_checklist_item('r1_conceito_moni_inc', 18, 'Comentários', 'texto_longo', 'comentarios');
  PERFORM public._seed_loteador_checklist_item(
    'r1_conceito_moni_inc', 90, 'Score do loteador', 'calculado', 'score_loteador', false,
    '{"formula":"loteadores_r1_score","min":0,"max":100}'::jsonb
  );
  PERFORM public._seed_loteador_checklist_item(
    'r1_conceito_moni_inc', 91, 'Classificação do loteador', 'calculado', 'classificacao_loteador', false,
    '{"formula":"loteadores_r1_classificacao"}'::jsonb
  );

  -- Fase 3: Viabilidade
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 1, 'Mapa de competidores', 'anexo', 'mapa_competidores');
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 2, 'Observações sobre competidores', 'texto_longo', 'observacoes_competidores');
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 3, 'Quadra showroom', 'texto_curto', 'quadra_showroom');
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 4, 'Lote showroom', 'texto_curto', 'lote_showroom');
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 5, 'Planta do lote', 'anexo', 'planta_lote');
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 6, 'Topografia', 'anexo', 'topografia');
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 7, 'Fotos do lote', 'anexo_multiplo', 'fotos_lote');
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 8, 'Vídeos do lote', 'anexo_multiplo', 'videos_lote');
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 9, 'Casa 1', 'catalog_casa', 'casa_1');
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 10, 'Casa 2', 'catalog_casa', 'casa_2');
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 11, 'Casa 3', 'catalog_casa', 'casa_3');
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 12, 'Manual de obra', 'anexo', 'manual_obra');
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 13, 'Gadgets', 'anexo', 'gadgets');
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 14, 'Riscos', 'texto_longo', 'riscos');
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 15, 'Oportunidades', 'texto_longo', 'oportunidades_viabilidade');
  PERFORM public._seed_loteador_checklist_item('viabilidade_moni_inc', 16, 'Parecer de viabilidade', 'texto_longo', 'parecer_viabilidade');

  -- Fase 4: Acoplamento (referência)
  PERFORM public._seed_loteador_checklist_item('acoplamento_moni_inc', 10, 'Link Acoplamento', 'url', 'link_acoplamento');
  PERFORM public._seed_loteador_checklist_item('acoplamento_moni_inc', 11, 'Link Gbox', 'url', 'link_gbox');
  PERFORM public._seed_loteador_checklist_item(
    'acoplamento_moni_inc', 12, 'Status acoplamento', 'select', 'status_acoplamento', false,
    '{"opcoes":["Não iniciado","Em andamento","Concluído"]}'::jsonb
  );
  PERFORM public._seed_loteador_checklist_item('acoplamento_moni_inc', 13, 'Observações acoplamento', 'texto_longo', 'observacoes_acoplamento');

  -- Fase 5: Execução do Material
  PERFORM public._seed_loteador_checklist_item('execucao_material_moni_inc', 1, 'Simulação casa 1', 'anexo', 'simulacao_casa_1');
  PERFORM public._seed_loteador_checklist_item('execucao_material_moni_inc', 2, 'Simulação casa 2', 'anexo', 'simulacao_casa_2');
  PERFORM public._seed_loteador_checklist_item('execucao_material_moni_inc', 3, 'Simulação casa 3', 'anexo', 'simulacao_casa_3');
  PERFORM public._seed_loteador_checklist_item('execucao_material_moni_inc', 4, 'Oferta showroom', 'anexo', 'oferta_showroom');
  PERFORM public._seed_loteador_checklist_item('execucao_material_moni_inc', 5, 'Material comercial', 'anexo_multiplo', 'material_comercial');
  PERFORM public._seed_loteador_checklist_item('execucao_material_moni_inc', 6, 'Material institucional', 'anexo_multiplo', 'material_institucional');
  PERFORM public._seed_loteador_checklist_item(
    'execucao_material_moni_inc', 7, 'Status material', 'select', 'status_material', false,
    '{"opcoes":["Não iniciado","Em andamento","Concluído"]}'::jsonb
  );

  -- Fase 6: R2
  PERFORM public._seed_loteador_checklist_item('r2_plano_teorico_moni_inc', 10, 'Casa sugerida', 'catalog_casa', 'casa_sugerida');
  PERFORM public._seed_loteador_checklist_item(
    'r2_plano_teorico_moni_inc', 11, 'Concorda com gadgets', 'select', 'concorda_gadgets', false,
    '{"opcoes":["Sim","Não","Parcialmente"]}'::jsonb
  );
  PERFORM public._seed_loteador_checklist_item('r2_plano_teorico_moni_inc', 12, 'Forma de pagamento', 'texto_longo', 'forma_pagamento');
  PERFORM public._seed_loteador_checklist_item(
    'r2_plano_teorico_moni_inc', 13, 'Loteador de acordo', 'select', 'loteador_de_acordo', false,
    '{"opcoes":["Sim","Não","Com ajustes"]}'::jsonb
  );
  PERFORM public._seed_loteador_checklist_item('r2_plano_teorico_moni_inc', 14, 'Ajustes solicitados', 'texto_longo', 'ajustes_solicitados');
  PERFORM public._seed_loteador_checklist_item('r2_plano_teorico_moni_inc', 15, 'Comentários finais', 'texto_longo', 'comentarios_finais');
  PERFORM public._seed_loteador_checklist_item('r2_plano_teorico_moni_inc', 16, 'Próximos passos', 'texto_longo', 'proximos_passos');

  -- Fase 7: Batalha de Casas — vazia (sem itens)

  -- Fase 8: Comitê
  PERFORM public._seed_loteador_checklist_item('comite_moni_inc', 10, 'Data do comitê', 'data', 'data_comite');
  PERFORM public._seed_loteador_checklist_item('comite_moni_inc', 11, 'Participantes', 'texto_longo', 'participantes_comite');
  PERFORM public._seed_loteador_checklist_item('comite_moni_inc', 12, 'Parecer comercial', 'texto_longo', 'parecer_comercial');
  PERFORM public._seed_loteador_checklist_item('comite_moni_inc', 13, 'Parecer produto', 'texto_longo', 'parecer_produto');
  PERFORM public._seed_loteador_checklist_item('comite_moni_inc', 14, 'Parecer crédito', 'texto_longo', 'parecer_credito');
  PERFORM public._seed_loteador_checklist_item('comite_moni_inc', 15, 'Parecer jurídico', 'texto_longo', 'parecer_juridico');
  PERFORM public._seed_loteador_checklist_item('comite_moni_inc', 16, 'Parecer operações', 'texto_longo', 'parecer_operacoes');
  PERFORM public._seed_loteador_checklist_item(
    'comite_moni_inc', 17, 'Resultado do comitê', 'select', 'resultado_comite', false,
    '{"opcoes":["Aprovado","Aprovado com ajustes","Reprovado"]}'::jsonb
  );
  PERFORM public._seed_loteador_checklist_item('comite_moni_inc', 18, 'Conclusão do comitê', 'texto_longo', 'conclusao_comite');

  -- Fase 9: Revisões
  PERFORM public._seed_loteador_checklist_item('revisoes_moni_inc', 1, 'Ajustes de revisão', 'texto_longo', 'ajustes_revisao');
  PERFORM public._seed_loteador_checklist_item('revisoes_moni_inc', 2, 'Responsável revisão', 'usuario', 'responsavel_revisao');
  PERFORM public._seed_loteador_checklist_item('revisoes_moni_inc', 3, 'Prazo revisão', 'data', 'prazo_revisao');
  PERFORM public._seed_loteador_checklist_item('revisoes_moni_inc', 4, 'Arquivos revisados', 'anexo_multiplo', 'arquivos_revisados');
  PERFORM public._seed_loteador_checklist_item(
    'revisoes_moni_inc', 5, 'Status revisão', 'select', 'status_revisao', false,
    '{"opcoes":["Não iniciado","Em andamento","Finalizado"]}'::jsonb
  );

  -- Fase 10: R3
  PERFORM public._seed_loteador_checklist_item('r3_ajustes_finais_moni_inc', 10, 'Data apresentação final', 'data', 'data_apresentacao_final');
  PERFORM public._seed_loteador_checklist_item('r3_ajustes_finais_moni_inc', 11, 'Participantes apresentação', 'texto_longo', 'participantes_apresentacao');
  PERFORM public._seed_loteador_checklist_item(
    'r3_ajustes_finais_moni_inc', 12, 'Aceite final', 'select', 'aceite_final', false,
    '{"opcoes":["Sim","Não","Pendente"]}'::jsonb
  );
  PERFORM public._seed_loteador_checklist_item('r3_ajustes_finais_moni_inc', 13, 'Observações finais', 'texto_longo', 'observacoes_finais');
  PERFORM public._seed_loteador_checklist_item('r3_ajustes_finais_moni_inc', 14, 'Encaminhamentos', 'texto_longo', 'encaminhamentos');

  -- Fase 11: Contrato
  PERFORM public._seed_loteador_checklist_item('fechar_contrato_moni_inc', 10, 'Contrato enviado', 'checkbox', 'contrato_enviado');
  PERFORM public._seed_loteador_checklist_item('fechar_contrato_moni_inc', 11, 'Contrato assinado', 'checkbox', 'contrato_assinado');
  PERFORM public._seed_loteador_checklist_item('fechar_contrato_moni_inc', 12, 'Data assinatura', 'data', 'data_assinatura');
  PERFORM public._seed_loteador_checklist_item('fechar_contrato_moni_inc', 13, 'CNPJ contratante', 'cnpj', 'cnpj_contratante');
  PERFORM public._seed_loteador_checklist_item('fechar_contrato_moni_inc', 14, 'Contrato anexado', 'anexo', 'contrato_anexado');
  PERFORM public._seed_loteador_checklist_item('fechar_contrato_moni_inc', 15, 'Documentos complementares', 'anexo_multiplo', 'documentos_complementares');

  -- Fase 12: Abertura SPE
  PERFORM public._seed_loteador_checklist_item('abertura_spe_moni_inc', 10, 'SPE aberta', 'checkbox', 'spe_aberta');
  PERFORM public._seed_loteador_checklist_item('abertura_spe_moni_inc', 11, 'Data abertura SPE', 'data', 'data_abertura_spe');
  PERFORM public._seed_loteador_checklist_item(
    'abertura_spe_moni_inc', 12, 'Status diligência', 'select', 'status_diligencia', false,
    '{"opcoes":["Não iniciada","Em andamento","Concluída"]}'::jsonb
  );
  PERFORM public._seed_loteador_checklist_item('abertura_spe_moni_inc', 13, 'Imagens showroom', 'anexo_multiplo', 'imagens_showroom');
  PERFORM public._seed_loteador_checklist_item(
    'abertura_spe_moni_inc', 14, 'Funding', 'select', 'funding', false,
    '{"opcoes":["Recurso próprio","Moní Capital"]}'::jsonb
  );
  PERFORM public._seed_loteador_checklist_item(
    'abertura_spe_moni_inc', 15, 'Status final', 'select', 'status_final', false,
    '{"opcoes":["Pronto para execução","Pendente ajustes","Pendente documentação"]}'::jsonb
  );
END;
$$;

-- Ocultar widget legado rede_loteador (painel persistente substitui) — em qualquer slug de viabilidade
UPDATE public.kanban_fase_checklist_itens i
SET visivel_candidato = false, obrigatorio = false
FROM public.kanban_fases f
WHERE i.fase_id = f.id
  AND f.slug IN ('dados_loteador_moni_inc', 'viabilidade_moni_inc')
  AND i.tipo = 'rede_loteador';

DROP FUNCTION IF EXISTS public._seed_loteador_checklist_item(TEXT, INT, TEXT, TEXT, TEXT, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS public._resolve_loteador_fase_id(UUID, TEXT[]);
