-- 530: Hub de Funis › Manutenções › Funil Moní Care (10 fases + checklists).
-- Idempotente. DEV first. Não aplicar em PROD sem confirmação.

INSERT INTO public.kanbans (id, nome, descricao, ativo)
SELECT v.id, v.nome, v.descricao, true
FROM (VALUES
  (
    'b3d47f5e-0a86-4c24-89f3-5e2b8a1c4d70'::uuid,
    'Funil Moní Care'::text,
    'Pós-entrega e revisões programadas (Rev. 00 a 07), chamados de garantia e serviços pagos. Ciclo de 5 anos a partir da entrega.'::text
  )
) AS v(id, nome, descricao)
WHERE NOT EXISTS (SELECT 1 FROM public.kanbans k WHERE k.id = v.id OR k.nome = v.nome);

INSERT INTO public.kanban_fases (
  kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
)
SELECT
  v.kanban_id, v.nome, v.slug, v.ordem, v.sla_dias, v.sla_tipo, v.fase_conversao, true, v.instrucoes, '[]'::jsonb
FROM (VALUES
  (
    'b3d47f5e-0a86-4c24-89f3-5e2b8a1c4d70'::uuid,
    'Novo Acionamento'::text, 'care_novo_acionamento'::text, 1, 1, 'corridos'::text, false,
    E'ENTRADA: WhatsApp (11) 98955-3846 ou calendário de revisão programada.\nSLA: 24h corridas (1ª resposta).\nResponsável: Atendimento / Operações.\n1. Monitorar o WhatsApp oficial durante o horário comercial. Revisões programadas devem ser acionadas internamente com base no calendário de cada casa.\n2. Responder ao cliente em até 24 horas confirmando o recebimento.\n3. Criar o card com o nome do cliente, empreendimento e dados do acionamento.\n4. Caso o cliente não tenha enviado fotos, solicitá-las via WhatsApp.\n5. Identificar se é revisão programada ou chamado avulso.\n6. Preencher todos os campos obrigatórios antes de avançar para Triagem.'::text
  ),
  (
    'b3d47f5e-0a86-4c24-89f3-5e2b8a1c4d70'::uuid,
    'Triagem', 'care_triagem', 2, 1, 'uteis', false,
    E'SLA: 1 dia útil.\nResponsável: Coord. de Operações.\nSe classificado como serviço pago, pode gerar oportunidade no funil financeiro/comercial.\n1. Analisar fotos e descrição enviadas pelo cliente.\n2. Verificar o histórico de revisões da casa.\n3. Consultar a Tabela de Garantias (cobertura e prazo).\n4. Classificar: revisão programada, garantia, serviço pago ou improcedente.\n5. Se IMPROCEDENTE: comunicar o cliente e arquivar o card.\n6. Se SERVIÇO PAGO: informar que haverá orçamento e avançar para Agendamento.\n7. Se GARANTIA ou REVISÃO PROGRAMADA: avançar sem custo ao cliente.\n8. Designar o técnico responsável pela visita.'
  ),
  (
    'b3d47f5e-0a86-4c24-89f3-5e2b8a1c4d70'::uuid,
    'Agendamento', 'care_agendamento', 3, 3, 'uteis', false,
    E'SLA: 3 dias úteis para confirmar data.\nResponsável: Atendimento / Coord. Ops.\n1. Contatar o cliente via WhatsApp para propor data e horário.\n2. Verificar disponibilidade do técnico antes de confirmar.\n3. Confirmar visita e registrar data/horário definitivos no card.\n4. Enviar lembrete ao cliente 1 dia antes da visita.\n5. Registrar observações de acesso (portaria, pets, etc.) para o técnico.\n6. Se sem confirmação em 3 dias úteis: fazer follow-up e registrar a tentativa.'
  ),
  (
    'b3d47f5e-0a86-4c24-89f3-5e2b8a1c4d70'::uuid,
    'Visita Confirmada', 'care_visita_confirmada', 4, NULL::integer, 'uteis', false,
    E'SLA: aguarda a data agendada.\nResponsável: Técnico designado.\n1. Confirmar internamente com o técnico data, horário e endereço.\n2. Selecionar e enviar o formulário correto (Rev. 00 a 07 ou Chamado Avulso).\n3. Verificar materiais e ferramentas necessárias.\n4. Enviar lembrete ao cliente no dia anterior.\n5. Na data agendada, mover o card para Em Atendimento.'
  ),
  (
    'b3d47f5e-0a86-4c24-89f3-5e2b8a1c4d70'::uuid,
    'Em Atendimento', 'care_em_atendimento', 5, 1, 'uteis', false,
    E'SLA: 1 dia (visita presencial).\nResponsável: Técnico responsável.\nOK → Concluído | Ajustes → Orçamento / Parecer.\n1. Realizar a vistoria seguindo o checklist da revisão correspondente.\n2. Classificar cada item como Aprovado ou Necessário Ajuste.\n3. Tirar fotos de todos os itens com necessidade de ajuste.\n4. Coletar assinatura do cliente e do técnico.\n5. Se revisão programada com todos os itens aprovados: aplicar Selo e ir para Concluído.\n6. Se houver ajustes: avançar para Orçamento / Parecer.\n7. Em emergência com solução imediata: resolver e ir direto para Concluído.'
  ),
  (
    'b3d47f5e-0a86-4c24-89f3-5e2b8a1c4d70'::uuid,
    'Orçamento / Parecer', 'care_orcamento', 6, 2, 'uteis', false,
    E'SLA: 2 dias úteis para gerar orçamento.\nResponsável: Coord. Ops. / Comercial.\nSe serviço pago, pode gerar entrada no funil financeiro/comercial.\n1. Analisar os itens identificados como Necessário Ajuste.\n2. Verificar na Tabela de Garantias se os itens têm cobertura.\n3. Se GARANTIA: elaborar parecer técnico e agendar retorno sem custo.\n4. Se SEM COBERTURA: elaborar orçamento detalhado com valores.\n5. Enviar orçamento ao cliente via WhatsApp.\n6. Registrar o PDF do orçamento no card.\n7. Avançar para Aguardando Aprovação após o envio.'
  ),
  (
    'b3d47f5e-0a86-4c24-89f3-5e2b8a1c4d70'::uuid,
    'Aguardando Aprovação', 'care_aguardando_aprovacao', 7, 3, 'uteis', false,
    E'SLA: 3 dias úteis (follow-up se sem resposta).\nResponsável: Atendimento / Coord. Ops.\nAprovado → Em Execução | Reprovado → Arquivado.\n1. Aguardar retorno do cliente em até 3 dias úteis.\n2. Se sem resposta em 3 dias: follow-up via WhatsApp.\n3. Se APROVADO: avançar para Em Execução.\n4. Se REPROVADO: registrar motivo, oferecer alternativas e arquivar.\n5. Se pedir revisão do orçamento: voltar para Orçamento / Parecer.'
  ),
  (
    'b3d47f5e-0a86-4c24-89f3-5e2b8a1c4d70'::uuid,
    'Em Execução (Reparo)', 'care_em_execucao', 8, NULL::integer, 'uteis', false,
    E'SLA: definido por complexidade.\nResponsável: Técnico / Engenheiro.\nPode acionar fornecedores externos.\n1. Mobilizar técnicos, materiais e fornecedores conforme orçamento aprovado.\n2. Executar serviços no prazo combinado com o cliente.\n3. Registrar fotos do antes, durante e depois.\n4. Informar o cliente sobre andamento se o prazo for maior que 3 dias.\n5. Atualizar o Status da execução a cada mudança.\n6. Registrar intercorrências que alterem prazo ou escopo.\n7. Após conclusão total: avançar para Concluído.'
  ),
  (
    'b3d47f5e-0a86-4c24-89f3-5e2b8a1c4d70'::uuid,
    'Concluído', 'care_concluido', 9, 1, 'uteis', false,
    E'SLA: 1 dia útil para finalizar documentação.\nResponsável: Coord. de Operações.\nDispara NPS. Se revisão programada: atualiza calendário da casa.\n1. Confirmar com o técnico que todos os serviços foram finalizados.\n2. Digitalizar e anexar o formulário de revisão assinado.\n3. Verificar se o Selo de Certificação foi aplicado.\n4. Enviar mensagem de agradecimento ao cliente.\n5. Disparar pesquisa NPS via WhatsApp.\n6. Se revisão programada: registrar a próxima revisão no calendário.\n7. Registrar a nota NPS quando recebida.\n8. Mover para Arquivado após todos os campos preenchidos.'
  ),
  (
    'b3d47f5e-0a86-4c24-89f3-5e2b8a1c4d70'::uuid,
    'Arquivado', 'care_arquivado', 10, NULL::integer, 'uteis', true,
    E'Fase final. Sem saída para outros funis.\nResponsável: Atendimento.\n1. Verificar se todos os documentos estão anexados (formulário, orçamento, fotos, NPS).\n2. Selecionar o motivo do arquivamento.\n3. Manter histórico completo para auditorias, garantias e revisões.'
  )
) AS v(kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, instrucoes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_fases f
  WHERE f.kanban_id = v.kanban_id AND f.slug = v.slug
);

UPDATE public.kanban_fases f
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_dias = v.sla_dias,
  sla_tipo = v.sla_tipo,
  fase_conversao = v.fase_conversao,
  ativo = true,
  instrucoes = v.instrucoes
FROM (VALUES
  ('care_novo_acionamento'::text, 'Novo Acionamento'::text, 1, 1, 'corridos'::text, false,
    E'ENTRADA: WhatsApp (11) 98955-3846 ou calendário de revisão programada.\nSLA: 24h corridas (1ª resposta).\nResponsável: Atendimento / Operações.\n1. Monitorar o WhatsApp oficial durante o horário comercial. Revisões programadas devem ser acionadas internamente com base no calendário de cada casa.\n2. Responder ao cliente em até 24 horas confirmando o recebimento.\n3. Criar o card com o nome do cliente, empreendimento e dados do acionamento.\n4. Caso o cliente não tenha enviado fotos, solicitá-las via WhatsApp.\n5. Identificar se é revisão programada ou chamado avulso.\n6. Preencher todos os campos obrigatórios antes de avançar para Triagem.'::text),
  ('care_triagem', 'Triagem', 2, 1, 'uteis', false,
    E'SLA: 1 dia útil.\nResponsável: Coord. de Operações.\nSe classificado como serviço pago, pode gerar oportunidade no funil financeiro/comercial.\n1. Analisar fotos e descrição enviadas pelo cliente.\n2. Verificar o histórico de revisões da casa.\n3. Consultar a Tabela de Garantias (cobertura e prazo).\n4. Classificar: revisão programada, garantia, serviço pago ou improcedente.\n5. Se IMPROCEDENTE: comunicar o cliente e arquivar o card.\n6. Se SERVIÇO PAGO: informar que haverá orçamento e avançar para Agendamento.\n7. Se GARANTIA ou REVISÃO PROGRAMADA: avançar sem custo ao cliente.\n8. Designar o técnico responsável pela visita.'),
  ('care_agendamento', 'Agendamento', 3, 3, 'uteis', false,
    E'SLA: 3 dias úteis para confirmar data.\nResponsável: Atendimento / Coord. Ops.\n1. Contatar o cliente via WhatsApp para propor data e horário.\n2. Verificar disponibilidade do técnico antes de confirmar.\n3. Confirmar visita e registrar data/horário definitivos no card.\n4. Enviar lembrete ao cliente 1 dia antes da visita.\n5. Registrar observações de acesso (portaria, pets, etc.) para o técnico.\n6. Se sem confirmação em 3 dias úteis: fazer follow-up e registrar a tentativa.'),
  ('care_visita_confirmada', 'Visita Confirmada', 4, NULL::integer, 'uteis', false,
    E'SLA: aguarda a data agendada.\nResponsável: Técnico designado.\n1. Confirmar internamente com o técnico data, horário e endereço.\n2. Selecionar e enviar o formulário correto (Rev. 00 a 07 ou Chamado Avulso).\n3. Verificar materiais e ferramentas necessárias.\n4. Enviar lembrete ao cliente no dia anterior.\n5. Na data agendada, mover o card para Em Atendimento.'),
  ('care_em_atendimento', 'Em Atendimento', 5, 1, 'uteis', false,
    E'SLA: 1 dia (visita presencial).\nResponsável: Técnico responsável.\nOK → Concluído | Ajustes → Orçamento / Parecer.\n1. Realizar a vistoria seguindo o checklist da revisão correspondente.\n2. Classificar cada item como Aprovado ou Necessário Ajuste.\n3. Tirar fotos de todos os itens com necessidade de ajuste.\n4. Coletar assinatura do cliente e do técnico.\n5. Se revisão programada com todos os itens aprovados: aplicar Selo e ir para Concluído.\n6. Se houver ajustes: avançar para Orçamento / Parecer.\n7. Em emergência com solução imediata: resolver e ir direto para Concluído.'),
  ('care_orcamento', 'Orçamento / Parecer', 6, 2, 'uteis', false,
    E'SLA: 2 dias úteis para gerar orçamento.\nResponsável: Coord. Ops. / Comercial.\nSe serviço pago, pode gerar entrada no funil financeiro/comercial.\n1. Analisar os itens identificados como Necessário Ajuste.\n2. Verificar na Tabela de Garantias se os itens têm cobertura.\n3. Se GARANTIA: elaborar parecer técnico e agendar retorno sem custo.\n4. Se SEM COBERTURA: elaborar orçamento detalhado com valores.\n5. Enviar orçamento ao cliente via WhatsApp.\n6. Registrar o PDF do orçamento no card.\n7. Avançar para Aguardando Aprovação após o envio.'),
  ('care_aguardando_aprovacao', 'Aguardando Aprovação', 7, 3, 'uteis', false,
    E'SLA: 3 dias úteis (follow-up se sem resposta).\nResponsável: Atendimento / Coord. Ops.\nAprovado → Em Execução | Reprovado → Arquivado.\n1. Aguardar retorno do cliente em até 3 dias úteis.\n2. Se sem resposta em 3 dias: follow-up via WhatsApp.\n3. Se APROVADO: avançar para Em Execução.\n4. Se REPROVADO: registrar motivo, oferecer alternativas e arquivar.\n5. Se pedir revisão do orçamento: voltar para Orçamento / Parecer.'),
  ('care_em_execucao', 'Em Execução (Reparo)', 8, NULL::integer, 'uteis', false,
    E'SLA: definido por complexidade.\nResponsável: Técnico / Engenheiro.\nPode acionar fornecedores externos.\n1. Mobilizar técnicos, materiais e fornecedores conforme orçamento aprovado.\n2. Executar serviços no prazo combinado com o cliente.\n3. Registrar fotos do antes, durante e depois.\n4. Informar o cliente sobre andamento se o prazo for maior que 3 dias.\n5. Atualizar o Status da execução a cada mudança.\n6. Registrar intercorrências que alterem prazo ou escopo.\n7. Após conclusão total: avançar para Concluído.'),
  ('care_concluido', 'Concluído', 9, 1, 'uteis', false,
    E'SLA: 1 dia útil para finalizar documentação.\nResponsável: Coord. de Operações.\nDispara NPS. Se revisão programada: atualiza calendário da casa.\n1. Confirmar com o técnico que todos os serviços foram finalizados.\n2. Digitalizar e anexar o formulário de revisão assinado.\n3. Verificar se o Selo de Certificação foi aplicado.\n4. Enviar mensagem de agradecimento ao cliente.\n5. Disparar pesquisa NPS via WhatsApp.\n6. Se revisão programada: registrar a próxima revisão no calendário.\n7. Registrar a nota NPS quando recebida.\n8. Mover para Arquivado após todos os campos preenchidos.'),
  ('care_arquivado', 'Arquivado', 10, NULL::integer, 'uteis', true,
    E'Fase final. Sem saída para outros funis.\nResponsável: Atendimento.\n1. Verificar se todos os documentos estão anexados (formulário, orçamento, fotos, NPS).\n2. Selecionar o motivo do arquivamento.\n3. Manter histórico completo para auditorias, garantias e revisões.')
) AS v(slug, nome, ordem, sla_dias, sla_tipo, fase_conversao, instrucoes)
WHERE f.kanban_id = 'b3d47f5e-0a86-4c24-89f3-5e2b8a1c4d70'::uuid
  AND f.slug = v.slug;

DO $$
DECLARE
  r RECORD;
  v_fase_id uuid;
  v_item_id uuid;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- 01 Novo Acionamento
      ('care_novo_acionamento'::text, 1, 'Nome do cliente'::text, 'texto_curto'::text, 'care_nome_cliente'::text, true, '{}'::jsonb),
      ('care_novo_acionamento', 2, 'Nome do empreendimento / casa', 'texto_curto', 'care_empreendimento', true, '{}'::jsonb),
      ('care_novo_acionamento', 3, 'Data de entrega da casa', 'data', 'care_data_entrega', true, '{}'::jsonb),
      ('care_novo_acionamento', 4, 'Número de revisões realizadas', 'numero', 'care_revisoes_realizadas', true, '{}'::jsonb),
      ('care_novo_acionamento', 5, 'Tipo de acionamento', 'select', 'care_tipo_acionamento', true,
        '{"opcoes":["Revisão Programada","Chamado Avulso","Emergência","Dúvida"]}'::jsonb),
      ('care_novo_acionamento', 6, 'Canal de entrada', 'select', 'care_canal_entrada', true,
        '{"opcoes":["WhatsApp","Ligação","E-mail","Calendário interno"]}'::jsonb),
      ('care_novo_acionamento', 7, 'Descrição do problema / solicitação', 'texto_longo', 'care_descricao', true, '{}'::jsonb),
      ('care_novo_acionamento', 8, 'Fotos enviadas pelo cliente', 'anexo_multiplo', 'care_fotos_cliente', false, '{}'::jsonb),
      ('care_novo_acionamento', 9, 'Data do acionamento', 'data', 'care_data_acionamento', true, '{}'::jsonb),
      ('care_novo_acionamento', 10, 'Hora do acionamento', 'hora', 'care_hora_acionamento', true, '{}'::jsonb),
      -- 02 Triagem
      ('care_triagem', 1, 'Classificação do acionamento', 'select', 'care_classificacao', true,
        '{"opcoes":["Revisão Programada","Garantia","Serviço Pago","Improcedente"]}'::jsonb),
      ('care_triagem', 2, 'Número da revisão (se programada)', 'select', 'care_numero_revisao', false,
        '{"opcoes":["00","01","02","03","04","05","06","07"]}'::jsonb),
      ('care_triagem', 3, 'Itens relatados pelo cliente', 'texto_longo', 'care_itens_relatados', true, '{}'::jsonb),
      ('care_triagem', 4, 'Cobertura de garantia?', 'checkbox', 'care_cobertura_garantia', true, '{}'::jsonb),
      ('care_triagem', 5, 'Técnico responsável designado', 'usuario', 'care_tecnico_responsavel', true, '{}'::jsonb),
      ('care_triagem', 6, 'Observações da triagem', 'texto_longo', 'care_observacoes_triagem', false, '{}'::jsonb),
      -- 03 Agendamento
      ('care_agendamento', 1, 'Data proposta para visita', 'data', 'care_data_proposta', true, '{}'::jsonb),
      ('care_agendamento', 2, 'Data confirmada pelo cliente', 'data', 'care_data_confirmada', true, '{}'::jsonb),
      ('care_agendamento', 3, 'Horário da visita', 'hora', 'care_horario_visita', true, '{}'::jsonb),
      ('care_agendamento', 4, 'Técnico designado', 'usuario', 'care_tecnico_designado', true, '{}'::jsonb),
      ('care_agendamento', 5, 'Cliente confirmou?', 'checkbox', 'care_cliente_confirmou', true, '{}'::jsonb),
      ('care_agendamento', 6, 'Observações para o técnico', 'texto_longo', 'care_observacoes_tecnico', false, '{}'::jsonb),
      -- 04 Visita Confirmada
      ('care_visita_confirmada', 1, 'Data da visita', 'data', 'care_data_visita', true, '{}'::jsonb),
      ('care_visita_confirmada', 2, 'Formulário de revisão selecionado', 'select', 'care_formulario_revisao', true,
        '{"opcoes":["Rev. 00","Rev. 01","Rev. 02","Rev. 03","Rev. 04","Rev. 05","Rev. 06","Rev. 07","Chamado Avulso"]}'::jsonb),
      ('care_visita_confirmada', 3, 'Checklist pré-visita enviado ao técnico?', 'checkbox', 'care_checklist_enviado', true, '{}'::jsonb),
      ('care_visita_confirmada', 4, 'Material / ferramentas necessárias', 'texto_longo', 'care_material_necessario', false, '{}'::jsonb),
      -- 05 Em Atendimento
      ('care_em_atendimento', 1, 'Data de realização da visita', 'data', 'care_data_realizacao', true, '{}'::jsonb),
      ('care_em_atendimento', 2, 'Formulário de revisão preenchido?', 'checkbox', 'care_relatorio_preenchido', true, '{}'::jsonb),
      ('care_em_atendimento', 3, 'Qtd. de itens aprovados', 'numero', 'care_itens_aprovados', true, '{}'::jsonb),
      ('care_em_atendimento', 4, 'Qtd. de itens com ajuste necessário', 'numero', 'care_itens_ajuste', true, '{}'::jsonb),
      ('care_em_atendimento', 5, 'Fotos do atendimento', 'anexo_multiplo', 'care_fotos_atendimento', true, '{}'::jsonb),
      ('care_em_atendimento', 6, 'Assinatura do cliente coletada?', 'checkbox', 'care_assinatura_cliente', true, '{}'::jsonb),
      ('care_em_atendimento', 7, 'Assinatura do técnico coletada?', 'checkbox', 'care_assinatura_tecnico', true, '{}'::jsonb),
      ('care_em_atendimento', 8, 'Selo de certificação aplicado?', 'select', 'care_selo_certificacao', false,
        '{"opcoes":["Sim","Não","N.A."]}'::jsonb),
      ('care_em_atendimento', 9, 'Observações gerais da vistoria', 'texto_longo', 'care_observacoes_vistoria', false, '{}'::jsonb),
      -- 06 Orçamento / Parecer
      ('care_orcamento', 1, 'Itens a reparar / ajustar', 'texto_longo', 'care_itens_reparar', true, '{}'::jsonb),
      ('care_orcamento', 2, 'Fotos dos itens com ajuste', 'anexo_multiplo', 'care_fotos_itens', true, '{}'::jsonb),
      ('care_orcamento', 3, 'Cobertura', 'select', 'care_tipo_cobertura', true,
        '{"opcoes":["Garantia (sem custo)","Serviço Pago"]}'::jsonb),
      ('care_orcamento', 4, 'Valor do orçamento (R$)', 'numero', 'care_valor_orcamento', false, '{}'::jsonb),
      ('care_orcamento', 5, 'Documento do orçamento', 'anexo', 'care_doc_orcamento', false, '{}'::jsonb),
      ('care_orcamento', 6, 'Orçamento enviado ao cliente?', 'checkbox', 'care_orcamento_enviado', true, '{}'::jsonb),
      ('care_orcamento', 7, 'Data de envio ao cliente', 'data', 'care_data_envio_cliente', true, '{}'::jsonb),
      -- 07 Aguardando Aprovação
      ('care_aguardando_aprovacao', 1, 'Data de envio do orçamento', 'data', 'care_data_envio_orcamento', true, '{}'::jsonb),
      ('care_aguardando_aprovacao', 2, 'Status da aprovação', 'select', 'care_status_aprovacao', true,
        '{"opcoes":["Pendente","Aprovado","Reprovado","Sem resposta"]}'::jsonb),
      ('care_aguardando_aprovacao', 3, 'Data da resposta do cliente', 'data', 'care_data_resposta', false, '{}'::jsonb),
      ('care_aguardando_aprovacao', 4, 'Observações do cliente', 'texto_longo', 'care_observacoes_cliente', false, '{}'::jsonb),
      -- 08 Em Execução
      ('care_em_execucao', 1, 'Data de início da execução', 'data', 'care_data_inicio', true, '{}'::jsonb),
      ('care_em_execucao', 2, 'Previsão de conclusão', 'data', 'care_previsao_conclusao', true, '{}'::jsonb),
      ('care_em_execucao', 3, 'Serviços executados', 'texto_longo', 'care_servicos_executados', true, '{}'::jsonb),
      ('care_em_execucao', 4, 'Fornecedores envolvidos', 'texto_curto', 'care_fornecedores', false, '{}'::jsonb),
      ('care_em_execucao', 5, 'Status da execução', 'select', 'care_status_execucao', true,
        '{"opcoes":["Em andamento","Concluído","Pausado","Aguardando material"]}'::jsonb),
      ('care_em_execucao', 6, 'Fotos do serviço (antes/durante/depois)', 'anexo_multiplo', 'care_fotos_servico', true, '{}'::jsonb),
      ('care_em_execucao', 7, 'Observações', 'texto_longo', 'care_observacoes_exec', false, '{}'::jsonb),
      -- 09 Concluído
      ('care_concluido', 1, 'Data de conclusão', 'data', 'care_data_conclusao', true, '{}'::jsonb),
      ('care_concluido', 2, 'Formulário de revisão digitalizado', 'anexo', 'care_formulario_digitalizado', true, '{}'::jsonb),
      ('care_concluido', 3, 'Assinatura do cliente coletada?', 'checkbox', 'care_assinatura_cliente_final', true, '{}'::jsonb),
      ('care_concluido', 4, 'Selo de certificação aplicado?', 'select', 'care_selo_aplicado', false,
        '{"opcoes":["Sim","Não","N.A."]}'::jsonb),
      ('care_concluido', 5, 'Próxima revisão prevista (data)', 'data', 'care_proxima_revisao_data', false, '{}'::jsonb),
      ('care_concluido', 6, 'Número da próxima revisão', 'select', 'care_proxima_revisao_numero', false,
        '{"opcoes":["01","02","03","04","05","06","07"]}'::jsonb),
      ('care_concluido', 7, 'NPS enviado ao cliente?', 'checkbox', 'care_nps_enviado', true, '{}'::jsonb),
      ('care_concluido', 8, 'Nota NPS recebida', 'numero', 'care_nota_nps', false, '{}'::jsonb),
      -- 10 Arquivado
      ('care_arquivado', 1, 'Motivo do arquivamento', 'select', 'care_motivo_arquivamento', true,
        '{"opcoes":["Concluído com sucesso","Reprovado pelo cliente","Improcedente","Cliente não respondeu","Cancelado pela Moní"]}'::jsonb),
      ('care_arquivado', 2, 'Data do arquivamento', 'data', 'care_data_arquivamento', true, '{}'::jsonb)
    ) AS t(fase_slug, ordem, label, tipo, campo_slug, obrigatorio, config_json)
  LOOP
    SELECT id INTO v_fase_id
    FROM public.kanban_fases
    WHERE slug = r.fase_slug
      AND kanban_id = 'b3d47f5e-0a86-4c24-89f3-5e2b8a1c4d70'::uuid
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
          obrigatorio = r.obrigatorio, visivel_candidato = true, config_json = r.config_json
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, r.ordem, r.label, r.tipo, r.obrigatorio, true, r.campo_slug, r.config_json
      );
    END IF;
  END LOOP;
END $$;

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
WHERE f.kanban_id = 'b3d47f5e-0a86-4c24-89f3-5e2b8a1c4d70'::uuid
  AND COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id
      AND i.campo_slug = 'responsavel_da_fase'
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('530', 'funil_moni_care')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
