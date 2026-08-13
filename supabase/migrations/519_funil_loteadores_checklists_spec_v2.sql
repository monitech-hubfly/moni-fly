-- 519: Funil Loteadores — substituir fields/instruções dos checklists (spec v2).
-- Não deleta itens nem respostas. Oculta campos fora do spec SOMENTE se não tiverem dados.
-- Idempotente.

DO $$
DECLARE
  v_kanban_id UUID := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  v_fase_id UUID;
  v_item_id UUID;
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    RAISE NOTICE '519: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  -- ─── Instruções (texto exato do spec) ─────────────────────────────────────
  UPDATE public.kanban_fases SET instrucoes =
    E'1. Se for indicação via Frank: alinhar com Frank antes de abordar o loteador diretamente.\n'
    '2. Agendar a R1 já neste primeiro contato — não deixar a conversa em aberto.'
  WHERE kanban_id = v_kanban_id AND slug IN ('primeiro_contato_moni_inc', 'loteador_cadastro');

  UPDATE public.kanban_fases SET instrucoes =
    E'1. Apresentar quem somos e o que oferecemos — não assumir que o loteador já sabe do produto.\n'
    '2. Perguntar dados em aberto no cadastro.\n'
    '3. Identificar se há lote adequado para ser o showroom — anotar metragem, frente e localização.\n'
    '4. Registrar os próximos passos acordados no card antes de encerrar o dia.\n'
    '5. Caso tenha, enviar o NDA imediatamente após a R1, com interesse do parceiro confirmado.'
  WHERE kanban_id = v_kanban_id AND slug = 'r1_conceito_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    '1. Subir para assinaturas digitais e aguardar assinaturas.'
  WHERE kanban_id = v_kanban_id AND slug = 'nda_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    E'1. Avaliar se é possível opcionar o lote sem visita presencial.\n'
    '2. Registrar a justificativa caso a visita presencial seja indispensável.\n'
    '3. Anexar o documento de opção antes de passar para a próxima fase.'
  WHERE kanban_id = v_kanban_id AND slug = 'opcao_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    E'1. Enviar o formulário de ficha imediatamente após a opção do lote — não aguardar o parceiro pedir.\n'
    '2. Se não houver retorno em 2 d.u., fazer follow-up diário e registrar no card.\n'
    '3. Avaliar se a ficha está minimamente completa para iniciar a viabilidade — não exigir 100% se os dados essenciais estiverem preenchidos.\n'
    '4. Campos mínimos para avançar: dados do condomínio, quantidade de lotes, preço médio, metragem e planta cadastral.\n'
    '5. Registrar as pendências da ficha para acompanhar e completar ao longo do processo.'
  WHERE kanban_id = v_kanban_id AND slug = 'aguardando_ficha_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    E'1. Mapa de Competidores.\n'
    '2. Preencher BCA.\n'
    '3. Preparar 3 ofertas — uma delas deve incluir o showroom.\n'
    '4. Simular planilhas.\n'
    '5. Definir o produto do showroom, demais produtos que podem ser ofertados + gadgets.\n'
    '6. Patrocínio.\n'
    '7. Como será o pagamento e crédito.'
  WHERE kanban_id = v_kanban_id AND slug = 'viabilidade_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    E'1. Utilizar a planta cadastral do lote enviada.\n'
    '2. Selecionar o modelo de casa compatível.\n'
    '3. Executar o configurador.\n'
    '4. Atenção à topografia.\n'
    '5. Gerar o arquivo final do acoplamento.'
  WHERE kanban_id = v_kanban_id AND slug = 'acoplamento_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    E'1. Montar o PPT com base nas 3 ofertas definidas na etapa de viabilidade.\n'
    '2. Incluir o acoplamento visual.\n'
    '3. O material deve ser validado internamente antes de ser enviado ao parceiro.'
  WHERE kanban_id = v_kanban_id AND slug = 'execucao_material_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    E'1. Revisar o material antes de apresentar ao parceiro.\n'
    '2. Verificar se os números estão corretos (taxas, simulações, composição de preço).\n'
    '3. Verificar se o acoplamento está coerente.\n'
    '4. Se houver ajustes, executar nesta fase.'
  WHERE kanban_id = v_kanban_id AND slug = 'validacao_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    E'1. Apresentar as ofertas.\n'
    '2. Explicar a lógica de composição de preço.\n'
    '3. Discutir a forma de pagamento.\n'
    '4. Registrar todos os feedbacks do parceiro durante a reunião.\n'
    '5. Se o parceiro solicitar ajustes, registrar com clareza quais são e retornar para produção.\n'
    '6. Confirmar próximos passos antes de encerrar: quem faz o quê, em que prazo.'
  WHERE kanban_id = v_kanban_id AND slug = 'r2_plano_teorico_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    E'1. Implementar os ajustes solicitados na R2.\n'
    '2. Enviar a versão revisada ao parceiro e aguardar confirmação antes de avançar.'
  WHERE kanban_id = v_kanban_id AND slug = 'revisoes_moni_inc';

  UPDATE public.kanban_fases SET instrucoes = NULL
  WHERE kanban_id = v_kanban_id AND slug = 'acoplamento_gbox_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    E'1. Enviar o material completo ao Comitê assim que o Acoplamento + Gbox estiver finalizado.\n'
    '2. Registrar todos os pontos levantados pelo Comitê, mesmo os que não gerarem bloqueio.\n'
    '3. Se aprovado com ressalvas, encaminhar as ressalvas para a fase de Revisões.\n'
    '4. Se reprovado, registrar a justificativa completa e retornar para ajuste na fase adequada.'
  WHERE kanban_id = v_kanban_id AND slug = 'comite_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    E'1. Incorporar todas as ressalvas levantadas pelo Comitê — não ignorar nenhuma.\n'
    '2. Documentar cada ajuste realizado para rastreabilidade.\n'
    '3. Validar internamente antes de avançar para a análise de precedentes.'
  WHERE kanban_id = v_kanban_id AND slug = 'revisoes_pos_comite_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    '1. Verificar necessidade de assinatura de Cto com Precedentes.'
  WHERE kanban_id = v_kanban_id AND slug = 'cto_precedentes_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    E'1. Solicitar ao parceiro todos os documentos necessários para a diligência no primeiro dia desta fase.\n'
    '2. Monitorar o recebimento dos documentos e fazer follow-up diário se necessário.\n'
    '3. Registrar todas as pendências e resolvê-las dentro do prazo de 10 d.u.'
  WHERE kanban_id = v_kanban_id AND slug = 'diligencia_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    E'1. Redigir o contrato de showroom com base nas condições aprovadas no Comitê e na Diligência.\n'
    '2. Enviar ao parceiro para revisão e assinatura dentro do SLA.\n'
    '3. Acompanhar ativamente a assinatura — não deixar o contrato parado sem retorno.'
  WHERE kanban_id = v_kanban_id AND slug = 'cto_showroom_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    E'1. Garantir que todos os anexos do card estejam organizados e nomeados corretamente.\n'
    '2. Permanecer disponível para dúvidas do time Waysers nos primeiros dias após a passagem.'
  WHERE kanban_id = v_kanban_id AND slug = 'passagem_waysers_moni_inc';

  UPDATE public.kanban_fases SET instrucoes =
    E'1. Enviar ao parceiro para revisão e assinatura dentro do SLA.\n'
    '2. Acompanhar ativamente — cobrar retorno se não houver resposta em 2 d.u.\n'
    '3. Registrar a data de assinatura e arquivar o documento assinado no card.'
  WHERE kanban_id = v_kanban_id AND slug = 'contrato_parceria_moni_inc';

  -- ─── Upsert campos do spec ────────────────────────────────────────────────
  -- colunas: fase_slug, ordem, label, tipo, campo_slug, obrigatorio, config_json
  FOR r IN
    SELECT * FROM (VALUES
      -- Fase 1 Primeiro Contato
      ('primeiro_contato_moni_inc'::text, 1, 'Nome do responsável / interlocutor'::text, 'texto_curto'::text, 'pc_nome_responsavel'::text, false, '{}'::jsonb),
      ('primeiro_contato_moni_inc', 2, 'Cargo / Função', 'texto_curto', 'pc_cargo_funcao', false, '{}'::jsonb),
      ('primeiro_contato_moni_inc', 3, 'Telefone', 'telefone', 'pc_telefone', false, '{}'::jsonb),
      ('primeiro_contato_moni_inc', 4, 'E-mail', 'email', 'pc_email', false, '{}'::jsonb),
      ('primeiro_contato_moni_inc', 5, 'Perfil do lead', 'select', 'pc_perfil_lead', false,
        '{"opcoes":["Dono de lote","Corretor","Loteador","Frank Loteador","Frank + Loteador"]}'::jsonb),
      ('primeiro_contato_moni_inc', 6, 'Data do primeiro contato', 'data', 'pc_data_primeiro_contato', false, '{}'::jsonb),
      ('primeiro_contato_moni_inc', 7, 'Agendamento de R1 confirmado', 'checkbox', 'pc_r1_agendamento_confirmado', false, '{}'::jsonb),

      -- Fase 2 R1 Conceito
      ('r1_conceito_moni_inc', 1, 'Data da reunião', 'data', 'r1_data_reuniao', false, '{}'::jsonb),
      ('r1_conceito_moni_inc', 2, 'Lote indicado para showroom?', 'texto_curto', 'r1_lote_showroom', false, '{}'::jsonb),
      ('r1_conceito_moni_inc', 3, 'Material enviado pós-reunião', 'url', 'r1_material_enviado', false, '{}'::jsonb),
      ('r1_conceito_moni_inc', 4, 'Próximos passos acordados', 'texto_longo', 'r1_proximos_passos', false, '{}'::jsonb),

      -- Fase 3 NDA
      ('nda_moni_inc', 1, 'Data de envio do NDA', 'data', 'data_envio_nda', false, '{}'::jsonb),
      ('nda_moni_inc', 2, 'Data de assinatura', 'data', 'data_assinatura_nda', false, '{}'::jsonb),
      ('nda_moni_inc', 3, 'Arquivo do NDA assinado', 'url', 'arquivo_nda_assinado', false, '{}'::jsonb),

      -- Fase 4 Opção
      ('opcao_moni_inc', 1, 'Lote selecionado e opcionado', 'texto_curto', 'lote_selecionado_opcionado', false, '{}'::jsonb),
      ('opcao_moni_inc', 2, 'Data da opção', 'data', 'data_opcao', false, '{}'::jsonb),
      ('opcao_moni_inc', 3, 'Documento de opção', 'url', 'documento_opcao', false, '{}'::jsonb),

      -- Fase 5 Aguardando Ficha — Cadastro do Parceiro
      ('aguardando_ficha_moni_inc', 1, 'Nome do responsável', 'texto_curto', 'ficha_nome_responsavel', true, '{"grupo":"Cadastro do Parceiro"}'::jsonb),
      ('aguardando_ficha_moni_inc', 2, 'Cargo / Função', 'texto_curto', 'ficha_cargo_funcao', true, '{"grupo":"Cadastro do Parceiro"}'::jsonb),
      ('aguardando_ficha_moni_inc', 3, 'Telefone', 'telefone', 'ficha_telefone', true, '{"grupo":"Cadastro do Parceiro"}'::jsonb),
      ('aguardando_ficha_moni_inc', 4, 'E-mail', 'email', 'ficha_email', true, '{"grupo":"Cadastro do Parceiro"}'::jsonb),
      -- Informações do Condomínio
      ('aguardando_ficha_moni_inc', 10, 'Nome do condomínio', 'texto_curto', 'nome_condominio', true, '{"grupo":"Informações do Condomínio"}'::jsonb),
      ('aguardando_ficha_moni_inc', 11, 'Cidade', 'texto_curto', 'cidade', true, '{"grupo":"Informações do Condomínio"}'::jsonb),
      ('aguardando_ficha_moni_inc', 12, 'Data de lançamento / TVO', 'data', 'data_lancamento_tvo', true, '{"grupo":"Informações do Condomínio"}'::jsonb),
      ('aguardando_ficha_moni_inc', 13, 'Qtd lotes', 'numero', 'qtd_lotes', false, '{"grupo":"Informações do Condomínio"}'::jsonb),
      ('aguardando_ficha_moni_inc', 14, 'Preço dos lotes', 'numero', 'preco_lotes', false, '{"grupo":"Informações do Condomínio","prefixo":"R$"}'::jsonb),
      ('aguardando_ficha_moni_inc', 15, 'Metragem dos lotes', 'numero', 'metragem_lotes', false, '{"grupo":"Informações do Condomínio","sufixo":"m²"}'::jsonb),
      ('aguardando_ficha_moni_inc', 16, 'Preço das casas', 'numero', 'preco_casas', false, '{"grupo":"Informações do Condomínio","prefixo":"R$"}'::jsonb),
      ('aguardando_ficha_moni_inc', 17, 'Metragem / tipologia das casas', 'texto_curto', 'metragem_tipologia_casas', false, '{"grupo":"Informações do Condomínio"}'::jsonb),
      ('aguardando_ficha_moni_inc', 18, 'Planta cadastral', 'anexo', 'planta_cadastral', false, '{"grupo":"Informações do Condomínio"}'::jsonb),
      ('aguardando_ficha_moni_inc', 19, 'Manual de obras', 'anexo', 'manual_obras', false, '{"grupo":"Informações do Condomínio"}'::jsonb),
      ('aguardando_ficha_moni_inc', 20, 'Links / casas concorrentes (se houver)', 'texto_longo', 'links_casas_concorrentes', false, '{"grupo":"Informações do Condomínio"}'::jsonb),
      ('aguardando_ficha_moni_inc', 21, 'Anexo casas concorrentes', 'anexo', 'anexo_casas_concorrentes', false, '{"grupo":"Informações do Condomínio"}'::jsonb),
      -- Venda e Carteira
      ('aguardando_ficha_moni_inc', 30, 'Lotes disponíveis', 'numero', 'lotes_disponiveis', false, '{"grupo":"Informações de Venda e Carteira"}'::jsonb),
      ('aguardando_ficha_moni_inc', 31, 'Lotes vendidos / quitados', 'numero', 'lotes_vendidos_quitados', false, '{"grupo":"Informações de Venda e Carteira"}'::jsonb),
      ('aguardando_ficha_moni_inc', 32, 'Carteira curta (qtd + financiamento)', 'texto_longo', 'carteira_curta', false, '{"grupo":"Informações de Venda e Carteira"}'::jsonb),
      ('aguardando_ficha_moni_inc', 33, 'Carteira longa (qtd + financiamento)', 'texto_longo', 'carteira_longa', false, '{"grupo":"Informações de Venda e Carteira"}'::jsonb),
      ('aguardando_ficha_moni_inc', 34, 'Tabela de preços', 'anexo', 'tabela_precos', false, '{"grupo":"Informações de Venda e Carteira"}'::jsonb),
      -- Campo livre
      ('aguardando_ficha_moni_inc', 40, 'Observações livres', 'texto_longo', 'observacoes_livres', false, '{"grupo":"Campo Livre"}'::jsonb),
      ('aguardando_ficha_moni_inc', 41, 'Anexo extra', 'anexo', 'anexo_extra', false, '{"grupo":"Campo Livre"}'::jsonb),

      -- Fase 8 Executar Material
      ('execucao_material_moni_inc', 1, 'PPT criado', 'url', 'ppt_criado', false, '{}'::jsonb),

      -- Fase 9 Validação
      ('validacao_moni_inc', 1, 'Data de validação', 'data', 'data_validacao', false, '{}'::jsonb),
      ('validacao_moni_inc', 2, 'Feedbacks / ajustes solicitados', 'texto_longo', 'feedbacks_ajustes', false, '{}'::jsonb),

      -- Fase 10 R2
      ('r2_plano_teorico_moni_inc', 1, 'Data da apresentação', 'data', 'r2_data_apresentacao', false, '{}'::jsonb),
      ('r2_plano_teorico_moni_inc', 2, 'Ajustes solicitados pelo parceiro', 'texto_longo', 'r2_ajustes_parceiro', false, '{}'::jsonb),
      ('r2_plano_teorico_moni_inc', 3, 'Forma de pagamento discutida', 'checkbox', 'r2_forma_pagamento_discutida', false, '{}'::jsonb),
      ('r2_plano_teorico_moni_inc', 4, 'Próximos passos acordados', 'texto_longo', 'r2_proximos_passos', false, '{}'::jsonb),

      -- Fase 11 Revisões
      ('revisoes_moni_inc', 1, 'Número de rodadas de revisão', 'numero', 'revisoes_n_rodadas', false, '{}'::jsonb),
      ('revisoes_moni_inc', 2, 'Ajustes implementados', 'texto_longo', 'revisoes_ajustes_implementados', false, '{}'::jsonb),
      ('revisoes_moni_inc', 3, 'Forma de pagamento definida', 'texto_longo', 'revisoes_forma_pagamento_definida', false, '{}'::jsonb),
      ('revisoes_moni_inc', 4, 'Aprovação final do parceiro', 'texto_curto', 'revisoes_aprovacao_final', false, '{}'::jsonb),

      -- Fase 13 Comitê
      ('comite_moni_inc', 1, 'Data da deliberação', 'data', 'comite_data_deliberacao', false, '{}'::jsonb),
      ('comite_moni_inc', 2, 'Decisão do Comitê', 'select', 'comite_decisao', false,
        '{"opcoes":["Aprovado","Aprovado com ressalvas","Reprovado"]}'::jsonb),
      ('comite_moni_inc', 3, 'Ressalvas / pontos de atenção', 'texto_longo', 'comite_ressalvas', false, '{}'::jsonb),
      ('comite_moni_inc', 4, 'Membros presentes', 'texto_curto', 'comite_membros', false, '{}'::jsonb),

      -- Fase 14 Revisões pós-Comitê
      ('revisoes_pos_comite_moni_inc', 1, 'Ajustes realizados', 'texto_longo', 'ajustes_realizados', false, '{}'::jsonb),
      ('revisoes_pos_comite_moni_inc', 2, 'Versão pós-Comitê', 'url', 'versao_pos_comite', false, '{}'::jsonb),
      ('revisoes_pos_comite_moni_inc', 3, 'Validado após revisões', 'checkbox', 'validado_apos_revisoes', false, '{}'::jsonb),

      -- Fase 15 Cto c/ Precedentes
      ('cto_precedentes_moni_inc', 1, 'Data da assinatura', 'data', 'data_assinatura_cto_precedentes', false, '{}'::jsonb),
      ('cto_precedentes_moni_inc', 2, 'Contrato', 'url', 'contrato_precedentes', false, '{}'::jsonb),
      ('cto_precedentes_moni_inc', 3, 'Motivo da Assinatura de Cto com Precedentes', 'texto_longo', 'motivo_assinatura_precedentes', false, '{}'::jsonb),

      -- Fase 16 Diligência
      ('diligencia_moni_inc', 1, 'Relatório / resumo da diligência', 'url', 'diligencia_relatorio', false, '{}'::jsonb),

      -- Fase 17 Cto Showroom
      ('cto_showroom_moni_inc', 1, 'Data de assinatura', 'data', 'showroom_data_assinatura', false, '{}'::jsonb),
      ('cto_showroom_moni_inc', 2, 'Arquivo do contrato assinado', 'url', 'showroom_contrato', false, '{}'::jsonb),

      -- Fase 18 Passagem Waysers
      ('passagem_waysers_moni_inc', 1, 'Briefing completo preparado', 'texto_longo', 'briefing_completo_preparado', false, '{}'::jsonb),

      -- Fase 19 Cto de Parceria
      ('contrato_parceria_moni_inc', 1, 'Data de assinatura', 'data', 'parceria_data_assinatura', false, '{}'::jsonb),
      ('contrato_parceria_moni_inc', 2, 'Arquivo do contrato assinado', 'url', 'parceria_contrato', false, '{}'::jsonb)
    ) AS t(fase_slug, ordem, label, tipo, campo_slug, obrigatorio, config)
  LOOP
    SELECT id INTO v_fase_id
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND (
        slug = r.fase_slug
        OR (r.fase_slug = 'primeiro_contato_moni_inc' AND slug = 'loteador_cadastro')
      )
    ORDER BY CASE WHEN slug = r.fase_slug THEN 0 ELSE 1 END
    LIMIT 1;
    IF v_fase_id IS NULL THEN CONTINUE; END IF;

    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = r.campo_slug
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = r.ordem,
          label = r.label,
          tipo = r.tipo,
          obrigatorio = r.obrigatorio,
          visivel_candidato = true,
          config_json = COALESCE(r.config, '{}'::jsonb)
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, r.ordem, r.label, r.tipo, r.obrigatorio, true, r.campo_slug,
        COALESCE(r.config, '{}'::jsonb)
      );
    END IF;
  END LOOP;

  -- ─── Ocultar campos fora do spec SEM dados gravados ───────────────────────
  UPDATE public.kanban_fase_checklist_itens i
  SET config_json = COALESCE(i.config_json, '{}'::jsonb) || jsonb_build_object('oculto_ui', true)
  FROM public.kanban_fases f
  WHERE i.fase_id = f.id
    AND f.kanban_id = v_kanban_id
    AND f.slug IN (
      'primeiro_contato_moni_inc','loteador_cadastro','r1_conceito_moni_inc','nda_moni_inc','opcao_moni_inc',
      'aguardando_ficha_moni_inc','viabilidade_moni_inc','dados_loteador_moni_inc','acoplamento_moni_inc',
      'execucao_material_moni_inc','validacao_moni_inc','r2_plano_teorico_moni_inc',
      'revisoes_moni_inc','acoplamento_gbox_moni_inc','comite_moni_inc',
      'revisoes_pos_comite_moni_inc','cto_precedentes_moni_inc','diligencia_moni_inc',
      'cto_showroom_moni_inc','passagem_waysers_moni_inc','contrato_parceria_moni_inc'
    )
    AND NOT EXISTS (
      SELECT 1 FROM (
        VALUES
          ('primeiro_contato_moni_inc','pc_nome_responsavel'),
          ('primeiro_contato_moni_inc','pc_cargo_funcao'),
          ('primeiro_contato_moni_inc','pc_telefone'),
          ('primeiro_contato_moni_inc','pc_email'),
          ('primeiro_contato_moni_inc','pc_perfil_lead'),
          ('primeiro_contato_moni_inc','pc_data_primeiro_contato'),
          ('primeiro_contato_moni_inc','pc_r1_agendamento_confirmado'),
          ('loteador_cadastro','pc_nome_responsavel'),
          ('loteador_cadastro','pc_cargo_funcao'),
          ('loteador_cadastro','pc_telefone'),
          ('loteador_cadastro','pc_email'),
          ('loteador_cadastro','pc_perfil_lead'),
          ('loteador_cadastro','pc_data_primeiro_contato'),
          ('loteador_cadastro','pc_r1_agendamento_confirmado'),
          ('r1_conceito_moni_inc','r1_data_reuniao'),
          ('r1_conceito_moni_inc','r1_lote_showroom'),
          ('r1_conceito_moni_inc','r1_material_enviado'),
          ('r1_conceito_moni_inc','r1_proximos_passos'),
          ('nda_moni_inc','data_envio_nda'),
          ('nda_moni_inc','data_assinatura_nda'),
          ('nda_moni_inc','arquivo_nda_assinado'),
          ('opcao_moni_inc','lote_selecionado_opcionado'),
          ('opcao_moni_inc','data_opcao'),
          ('opcao_moni_inc','documento_opcao'),
          ('aguardando_ficha_moni_inc','ficha_nome_responsavel'),
          ('aguardando_ficha_moni_inc','ficha_cargo_funcao'),
          ('aguardando_ficha_moni_inc','ficha_telefone'),
          ('aguardando_ficha_moni_inc','ficha_email'),
          ('aguardando_ficha_moni_inc','nome_condominio'),
          ('aguardando_ficha_moni_inc','cidade'),
          ('aguardando_ficha_moni_inc','data_lancamento_tvo'),
          ('aguardando_ficha_moni_inc','qtd_lotes'),
          ('aguardando_ficha_moni_inc','preco_lotes'),
          ('aguardando_ficha_moni_inc','metragem_lotes'),
          ('aguardando_ficha_moni_inc','preco_casas'),
          ('aguardando_ficha_moni_inc','metragem_tipologia_casas'),
          ('aguardando_ficha_moni_inc','planta_cadastral'),
          ('aguardando_ficha_moni_inc','manual_obras'),
          ('aguardando_ficha_moni_inc','links_casas_concorrentes'),
          ('aguardando_ficha_moni_inc','anexo_casas_concorrentes'),
          ('aguardando_ficha_moni_inc','lotes_disponiveis'),
          ('aguardando_ficha_moni_inc','lotes_vendidos_quitados'),
          ('aguardando_ficha_moni_inc','carteira_curta'),
          ('aguardando_ficha_moni_inc','carteira_longa'),
          ('aguardando_ficha_moni_inc','tabela_precos'),
          ('aguardando_ficha_moni_inc','observacoes_livres'),
          ('aguardando_ficha_moni_inc','anexo_extra'),
          ('execucao_material_moni_inc','ppt_criado'),
          ('validacao_moni_inc','data_validacao'),
          ('validacao_moni_inc','feedbacks_ajustes'),
          ('r2_plano_teorico_moni_inc','r2_data_apresentacao'),
          ('r2_plano_teorico_moni_inc','r2_ajustes_parceiro'),
          ('r2_plano_teorico_moni_inc','r2_forma_pagamento_discutida'),
          ('r2_plano_teorico_moni_inc','r2_proximos_passos'),
          ('revisoes_moni_inc','revisoes_n_rodadas'),
          ('revisoes_moni_inc','revisoes_ajustes_implementados'),
          ('revisoes_moni_inc','revisoes_forma_pagamento_definida'),
          ('revisoes_moni_inc','revisoes_aprovacao_final'),
          ('comite_moni_inc','comite_data_deliberacao'),
          ('comite_moni_inc','comite_decisao'),
          ('comite_moni_inc','comite_ressalvas'),
          ('comite_moni_inc','comite_membros'),
          ('revisoes_pos_comite_moni_inc','ajustes_realizados'),
          ('revisoes_pos_comite_moni_inc','versao_pos_comite'),
          ('revisoes_pos_comite_moni_inc','validado_apos_revisoes'),
          ('cto_precedentes_moni_inc','data_assinatura_cto_precedentes'),
          ('cto_precedentes_moni_inc','contrato_precedentes'),
          ('cto_precedentes_moni_inc','motivo_assinatura_precedentes'),
          ('diligencia_moni_inc','diligencia_relatorio'),
          ('cto_showroom_moni_inc','showroom_data_assinatura'),
          ('cto_showroom_moni_inc','showroom_contrato'),
          ('passagem_waysers_moni_inc','briefing_completo_preparado'),
          ('contrato_parceria_moni_inc','parceria_data_assinatura'),
          ('contrato_parceria_moni_inc','parceria_contrato')
      ) AS spec(fase_slug, campo_slug)
      WHERE spec.fase_slug = f.slug AND spec.campo_slug = i.campo_slug
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_respostas resp
      WHERE resp.item_id = i.id
        AND (
          NULLIF(btrim(COALESCE(resp.valor, '')), '') IS NOT NULL
          OR NULLIF(btrim(COALESCE(resp.arquivo_path, '')), '') IS NOT NULL
        )
    );

  -- Leftovers COM dados: garantir visíveis (não remover campos em uso).
  UPDATE public.kanban_fase_checklist_itens i
  SET config_json = COALESCE(i.config_json, '{}'::jsonb) - 'oculto_ui'
  FROM public.kanban_fases f
  WHERE i.fase_id = f.id
    AND f.kanban_id = v_kanban_id
    AND f.slug IN (
      'primeiro_contato_moni_inc','loteador_cadastro','r1_conceito_moni_inc','nda_moni_inc','opcao_moni_inc',
      'aguardando_ficha_moni_inc','viabilidade_moni_inc','dados_loteador_moni_inc','acoplamento_moni_inc',
      'execucao_material_moni_inc','validacao_moni_inc','r2_plano_teorico_moni_inc',
      'revisoes_moni_inc','acoplamento_gbox_moni_inc','comite_moni_inc',
      'revisoes_pos_comite_moni_inc','cto_precedentes_moni_inc','diligencia_moni_inc',
      'cto_showroom_moni_inc','passagem_waysers_moni_inc','contrato_parceria_moni_inc'
    )
    AND COALESCE(i.campo_slug, '') NOT IN (
      'responsavel_da_fase',
      'responsavel_da_fase_tipo',
      'responsavel_da_fase_usuario',
      'responsavel_fase',
      'responsavel_contato',
      'responsavel_revisao'
    )
    AND EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_respostas resp
      WHERE resp.item_id = i.id
        AND (
          NULLIF(btrim(COALESCE(resp.valor, '')), '') IS NOT NULL
          OR NULLIF(btrim(COALESCE(resp.arquivo_path, '')), '') IS NOT NULL
        )
    );

  RAISE NOTICE '519: checklists e instruções Loteadores spec v2 aplicados.';
END $$;

NOTIFY pgrst, 'reload schema';
