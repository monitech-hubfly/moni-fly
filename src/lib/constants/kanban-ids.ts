// IDs consultados diretamente do banco PROD — não alterar manualmente
export const KANBAN_IDS = {
  STEP_ONE:      '4d89f111-cef6-48aa-93ff-72d6406f0a32',
  PORTFOLIO:     'c57120a0-991c-422b-8def-4d16a9411d45',
  ACOPLAMENTO:   '15847602-231d-4937-a06f-82027eb87ef3',
  CONTABILIDADE: '26d1c83c-988e-40d7-8b78-470801b99c1f',
  CREDITO_OBRA:  '6463af1d-850d-4958-b74c-404f8d668e21',
  LOTEADORES:    '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c',
  OPERACOES:     'f6bba1de-a7a1-4b14-89d1-10c2f7bba636',
  JURIDICO:      '35fb5c8d-50c0-4999-bc16-89d53c2e758f',
  MONI_CAPITAL:  '724aef36-37de-4454-bf6f-ec481693aeeb',
  FUNDING:       '7c9e4a21-6b3d-4f82-a591-0d8e6f4b2c19',
  CONTRATACOES:  '5f40aa71-8156-423b-baa8-e3512e308c04',
  HDM_PRODUTO:         'a9e61d76-0461-4644-80c7-3ca50cbe4e9f',
  HDM_MODELO_VIRTUAL:  '92d0033b-fd8c-432d-a089-e78c41a7cf48',
  HDM_HOMOLOGACOES:    '69bf5668-7749-476a-a834-962a0bb0eef7',
  PROJETO_LEGAL:   '39de341d-aebf-481c-9118-ce6fc6574187',
  PROJETOS_LOCAIS: 'c2ab09bd-4bd6-491e-8734-281d7678a6ad',
  PROJETOS_LEGAIS: '23ad5ce1-59f8-4e74-acb8-69aa61228cd8',
  MOTOR01:         '202527ea-d284-4c49-94f5-e75b25d6910e',
  MARKETING_GRAVACAO:    'e8a14c2b-7d53-4f91-a6c0-2b9e5d8f1a47',
  MARKETING_PROGRAMACAO: 'f1b25d3c-8e64-4a02-b7d1-3c0f6e9a2b58',
  MARKETING_INC_TO_FLY:  'a2c36e4d-9f75-4b13-c8e2-4d1a7f0b3c69',
  MONI_CARE:             'b3d47f5e-0a86-4c24-89f3-5e2b8a1c4d70',
  /** Funil Corretores — migration 548 */
  CORRETORES: '1e23c356-9993-4f8e-9d09-e17995e8a5c6',
} as const

/** Nome canônico em `kanbans.nome` — Funil Crédito Obra. */
export const KANBAN_NOME_CREDITO_OBRA = 'Funil Crédito Obra' as const;

/** `kanbans.nome` → UUID canônico (PROD). Preferir na resolução do board. */
export const KANBAN_ID_BY_NOME: Record<string, string> = {
  'Funil Step One': KANBAN_IDS.STEP_ONE,
  'Funil Portfólio': KANBAN_IDS.PORTFOLIO,
  'Funil Acoplamento': KANBAN_IDS.ACOPLAMENTO,
  'Funil Contabilidade': KANBAN_IDS.CONTABILIDADE,
  [KANBAN_NOME_CREDITO_OBRA]: KANBAN_IDS.CREDITO_OBRA,
  /** @deprecated legado (migration 420) — preferir Funil Crédito Obra */
  'Funil Cash Me': KANBAN_IDS.CREDITO_OBRA,
  /** @deprecated legado (migration 114) */
  'Funil Crédito': KANBAN_IDS.CREDITO_OBRA,
  'Funil Loteadores': KANBAN_IDS.LOTEADORES,
  'Funil Operações': KANBAN_IDS.OPERACOES,
  'Funil Jurídico': KANBAN_IDS.JURIDICO,
  'Funil Divify': KANBAN_IDS.MONI_CAPITAL,
  /** @deprecated legado — preferir Funil Divify */
  'Funil Moní Capital': KANBAN_IDS.MONI_CAPITAL,
  'Funding': KANBAN_IDS.FUNDING,
  'Funil Contratações': KANBAN_IDS.CONTRATACOES,
  'Funil Produto': KANBAN_IDS.HDM_PRODUTO,
  'Funil Modelo Virtual': KANBAN_IDS.HDM_MODELO_VIRTUAL,
  'Funil Homologações': KANBAN_IDS.HDM_HOMOLOGACOES,
  'Funil Projeto Legal': KANBAN_IDS.PROJETO_LEGAL,
  'Funil Projetos Locais': KANBAN_IDS.PROJETOS_LOCAIS,
  'Funil Projetos Legais': KANBAN_IDS.PROJETOS_LEGAIS,
  'Funil Motor 01': KANBAN_IDS.MOTOR01,
  'Funil Gravação de Vídeos Externos': KANBAN_IDS.MARKETING_GRAVACAO,
  'Funil Programação de Conteúdo Semanal': KANBAN_IDS.MARKETING_PROGRAMACAO,
  'Funil Série Inc. to Fly': KANBAN_IDS.MARKETING_INC_TO_FLY,
  'Funil Moní Care': KANBAN_IDS.MONI_CARE,
  'Funil Corretores': KANBAN_IDS.CORRETORES,
};

export const FASE_IDS = {
  // Portfolio — gatilhos de bastão de IDA
  PORTFOLIO_STEP_3:          '6d019704-95f7-42ee-8a85-973ffafc236b',
  PORTFOLIO_STEP_4:          'fd05dc4a-b44a-470e-993f-5df79c223488',
  PORTFOLIO_STEP_7:          'd78771cb-f79d-4650-a056-f3e2dbc3f3a6',
  PORTFOLIO_CAPTACAO_CAPITAL: 'd7e79cd4-a8ba-4239-b7b4-b82ad07acb11',
  PORTFOLIO_PASSAGEM_WAYSER: '5f48a367-699b-4dc4-a310-377fc7d0ff88',
  PORTFOLIO_STEP_5:          '9e1c76ba-ce84-4dbd-ae40-e434dc068a81', // gate
  // Acoplamento — bastão de volta
  ACOPLAMENTO_APROVADO:      'b6a83104-e74f-4d0b-902b-2c4227227411',
  ACOPLAMENTO_REPROVADO:     '6d383485-9c9e-4f41-9d2a-c23c20b950c9',
  /** @deprecated legado — fase inativa desde migration 494; desfecho em CO_SHAREPOINT_3A */
  CREDITO_OBRA_APROVADO:     'da6b7ed6-3137-42aa-9cc7-0d3aec4e6cfd',
  /** @deprecated legado — fase inativa desde migration 494 */
  CREDITO_OBRA_REPROVADO:    'aadb078e-d11a-48d1-9a4e-ee10b9fe7df5',
  // Contabilidade
  CONTABILIDADE_SPE:         'a5facdfc-b6f2-41cb-aea2-63614712910b',
  CONTABILIDADE_CONCLUIDO:   'abb24459-c105-4aeb-8743-a681851dcb53',
  // Jurídico
  JURIDICO_RECEBIMENTO:      '3e1d4e8c-3bf8-419d-8cf8-a9cdfd5a89ab',
  JURIDICO_CONCLUIDO:        'd9a50e26-3d5f-486c-a560-7a971704790b',
  // Moní Capital
  CAPITAL_RECEBIMENTO:       '5761ce08-fff9-4415-acf7-a6021d9925e3',
  CAPITAL_CONCLUIDO:         '68d8e1e2-43a1-431b-9354-53c195ccd539',
  CAPITAL_NAO_ELEGIVEL:      '023e7fb8-c40e-479a-949e-126fa55de1a4',
  // Operações
  OPERACOES_PLANIALTIMETRICO: 'c3bea524-aeae-4b87-ba1f-5c83943d4770',
  OPERACOES_AGUARDANDO_CREDITO: '8b83e671-ef0c-4028-8b52-8f56579e8df0',
  OPERACOES_ENTREGUE:        '5b85ac83-a546-4c1d-9bf0-e5e40cf3d937',
  // Loteadores
  LOTEADORES_JURIDICO:       'b505fee6-67aa-4925-b464-b80ceaa04567',
  // Projetos Locais
  PROJETOS_LOCAIS_CONCLUIDO: '4d3b70c2-d281-415c-b87c-daf54241729e',
} as const

export const FASE_SLUGS = {
  // Gatilhos de IDA
  STEP_3:             'step_3',
  STEP_4:             'step_4',
  STEP_7:             'step_7',
  CAPTACAO_CAPITAL:   'captacao_moni_capital',
  PASSAGEM_WAYSER:    'passagem_wayser',
  AGUARDANDO_CREDITO: 'aguardando_credito',
  PROD_PUBLICADO: 'prod_publicado',
  APROVACAO_CONDOMINIO: 'aprovacao_condominio',
  /** Fase do Funil Portfólio — dispara bastão para Funil Acoplamento. */
  ACOPLAMENTO: 'acoplamento',

  // ─── Funil Loteadores (esteira v1 — 21 fases ativas) ───────────────────────
  LOTEADORES_PRIMEIRO_CONTATO: 'primeiro_contato_moni_inc',
  LOTEADORES_R1_CONCEITO: 'r1_conceito_moni_inc',
  /** Alias pedido — NDA. */
  NDA_MONI_INC: 'nda_moni_inc',
  LOTEADORES_NDA: 'nda_moni_inc',
  /** Alias pedido — Opção. */
  OPCAO_MONI_INC: 'opcao_moni_inc',
  LOTEADORES_OPCAO: 'opcao_moni_inc',
  /** Alias pedido — Aguardando Ficha. */
  AGUARDANDO_FICHA_MONI_INC: 'aguardando_ficha_moni_inc',
  LOTEADORES_AGUARDANDO_FICHA: 'aguardando_ficha_moni_inc',
  /** Alias pedido — Novo Produto (após Viabilidade / Premissas). */
  NOVO_PRODUTO_MONI_INC: 'novo_produto_moni_inc',
  LOTEADORES_NOVO_PRODUTO: 'novo_produto_moni_inc',
  LOTEADORES_VIABILIDADE: 'viabilidade_moni_inc',
  /** Funil Loteadores — Dados do Loteador (legado; preferir VIABILIDADE). */
  LOTEADORES_DADOS_LOTEADOR: 'dados_loteador_moni_inc',
  LOTEADORES_ACOPLAMENTO: 'acoplamento_moni_inc',
  LOTEADORES_EXECUCAO_MATERIAL: 'execucao_material_moni_inc',
  /** Alias pedido — Validação. */
  VALIDACAO_MONI_INC: 'validacao_moni_inc',
  LOTEADORES_VALIDACAO: 'validacao_moni_inc',
  LOTEADORES_R2_PLANO_TEORICO: 'r2_plano_teorico_moni_inc',
  LOTEADORES_REVISOES: 'revisoes_moni_inc',
  /** Alias pedido — Acoplamento + Gbox. */
  ACOPLAMENTO_GBOX_MONI_INC: 'acoplamento_gbox_moni_inc',
  LOTEADORES_ACOPLAMENTO_GBOX: 'acoplamento_gbox_moni_inc',
  LOTEADORES_COMITE: 'comite_moni_inc',
  /** Alias pedido — Revisões pós-Comitê. */
  REVISOES_POS_COMITE_MONI_INC: 'revisoes_pos_comite_moni_inc',
  LOTEADORES_REVISOES_POS_COMITE: 'revisoes_pos_comite_moni_inc',
  /** Alias pedido — Cto c/ Precedentes. */
  CTO_PRECEDENTES_MONI_INC: 'cto_precedentes_moni_inc',
  LOTEADORES_CTO_PRECEDENTES: 'cto_precedentes_moni_inc',
  LOTEADORES_DILIGENCIA: 'diligencia_moni_inc',
  /** Cto Showroom (ex-fechar_contrato_moni_inc). */
  LOTEADORES_CTO_SHOWROOM: 'cto_showroom_moni_inc',
  /** Alias pedido — Passagem para Waysers. */
  PASSAGEM_WAYSERS_MONI_INC: 'passagem_waysers_moni_inc',
  LOTEADORES_PASSAGEM_WAYSERS: 'passagem_waysers_moni_inc',
  LOTEADORES_CONTRATO_PARCERIA: 'contrato_parceria_moni_inc',
  /** Fase terminal de conclusão. */
  ASSINADOS_MONI_INC: 'assinados_moni_inc',
  LOTEADORES_ASSINADOS: 'assinados_moni_inc',

  /** @deprecated Fase inativa (esteira v1) — Batalha de Casas. */
  LOTEADORES_BATALHA_CASAS: 'batalha_casas_moni_inc',
  /** @deprecated Fase inativa (esteira v1) — R3 Ajustes Finais. */
  LOTEADORES_R3_AJUSTES_FINAIS: 'r3_ajustes_finais_moni_inc',
  /** @deprecated Fase inativa (esteira v1) — Moní Capital. */
  LOTEADORES_MONI_CAPITAL: 'moni_capital_moni_inc',
  /** @deprecated Fase inativa (esteira v1) — Abertura da SPE. */
  LOTEADORES_ABERTURA_SPE: 'abertura_spe_moni_inc',
  /** @deprecated Slug antigo de Cto Showroom. */
  LOTEADORES_FECHAR_CONTRATO: 'fechar_contrato_moni_inc',

  /** Funil Acoplamento — primeira fase (entrada). */
  ACOPLAMENTO_NOVO: 'novo_acoplamento',
  /** Funil Acoplamento — gate Gbox/Acoplamento antes de avançar. */
  MODELAGEM_CASA_GBOX: 'modelagem_casa_gbox',
  /** Funil Acoplamento — entre Validação e Alterações. */
  ACOPLAMENTO_AGUARDANDO_COMITE: 'aguardando_comite_acoplamento',
  APROVACAO_PREFEITURA: 'aprovacao_prefeitura',
  /** Funil Operações — Transferência do Terreno (slug legado: processos_cartorarios). */
  PROCESSOS_CARTORARIOS: 'processos_cartorarios',
  /** Funil Operações — fase Em Obra. */
  EM_OBRA:            'em_obra',
  REVISAO_BCA:        'revisao_bca',
  PROJETO_LEGAL:      'projeto_legal',
  LOTEADOR_JURIDICO:  'loteador_juridico',
  // Gatilhos de VOLTA
  ACOPLAMENTO_APROVADO:      'acoplamento_aprovado',
  ACOPLAMENTO_REPROVADO:     'acoplamento_reprovado',
  // Funil Crédito Obra (KANBAN_IDS.CREDITO_OBRA) — fluxo ordem 1–13 (migration 494)
  CO_NOVO_PROJETO:            'co_novo_projeto',
  CO_BOOK:                    'co_book',
  CO_ENVIO_CASHME:            'co_envio_cashme',
  /** @deprecated legado — fase inativa (migration 491) */
  CO_OUTRO_PARCEIRO:          'co_outro_parceiro',
  CO_DOCUMENTACAO_ALVARA:     'co_documentacao_alvara',
  CO_VALIDACAO_CONTRATO:      'co_validacao_contrato',
  CO_CONTRATO_ASSINATURAS:    'co_contrato_assinaturas',
  CO_FOLLOWUP_CARTORIO:       'co_followup_cartorio',
  CO_AGUARDANDO_1A_TRANCHE:   'co_aguardando_1a_tranche',
  CO_SOLICITACAO_TRANCHE:     'co_solicitacao_tranche',
  CO_SHAREPOINT_CASHME:       'co_sharepoint_cashme',
  CO_ACOMPANHAMENTO_TRANCHE:  'co_acompanhamento_tranche',
  CO_NECESSIDADE_3A_TRANCHE:  'co_necessidade_3a_tranche',
  /** Fase terminal — Concluídos (bastão credito_obra_ok) */
  CO_SHAREPOINT_3A:           'co_sharepoint_3a',
  /** @deprecated legado — fase inativa (migration 494) */
  CO_ACOMPANHAMENTO_3A:       'co_acompanhamento_3a',
  /** @deprecated legado — fase inativa (migration 494) */
  CO_NECESSIDADE_4A_TRANCHE:  'co_necessidade_4a_tranche',
  /** @deprecated legado — fase inativa (migration 494) */
  CO_SHAREPOINT_4A:           'co_sharepoint_4a',
  /** @deprecated legado — fase inativa (migration 494) */
  CO_ACOMPANHAMENTO_4A:       'co_acompanhamento_4a',
  /** @deprecated legado — fase inativa (migration 494) */
  CO_NECESSIDADE_5A_TRANCHE:  'co_necessidade_5a_tranche',
  /** @deprecated legado — fase inativa (migration 494) */
  CO_SHAREPOINT_5A:           'co_sharepoint_5a',
  /** @deprecated legado — fase inativa (migration 494) */
  CO_ACOMPANHAMENTO_5A:       'co_acompanhamento_5a',
  /** @deprecated legado — fase inativa (migration 494) */
  CO_NECESSIDADE_6A_TRANCHE:  'co_necessidade_6a_tranche',
  /** @deprecated legado — fase inativa (migration 494) */
  CO_SHAREPOINT_6A:           'co_sharepoint_6a',
  /** @deprecated legado — fase inativa (migration 494) */
  CO_ACOMPANHAMENTO_6A:       'co_acompanhamento_6a',
  /** @deprecated legado — fase inativa (migration 494) */
  CREDITO_OBRA_APROVADO:      'credito_obra_aprovado',
  /** @deprecated legado — fase inativa (migration 494) */
  CREDITO_OBRA_REPROVADO:     'credito_obra_reprovado',
  // Funil Projeto Legal (KANBAN_IDS.PROJETO_LEGAL) — fluxo ordem 1–14 (PROD)
  PL_NOVA_DEMANDA:              'pl_nova_demanda',
  PL_PONTOS_EM_ABERTO:          'pl_pontos_em_aberto',
  PL_EM_EXECUCAO:               'pl_em_execucao',
  PL_EM_VALIDACAO:              'pl_em_validacao',
  PL_C_PROTOCOLO_ANDAMENTO:     'pl_c_protocolo_andamento',
  PL_C_EM_COMUNIQUESE:          'pl_c_em_comuniquese',
  PL_C_VALIDACAO_COMUNIQUESE:   'pl_c_validacao_comuniquese',
  PL_C_PROJETO_APROVADO:        'pl_c_projeto_aprovado',
  PL_AGUARDANDO_PREFEITURA:     'pl_aguardando_prefeitura',
  PL_P_PROTOCOLO_ANDAMENTO:     'pl_p_protocolo_andamento',
  PL_P_EM_COMUNIQUESE:          'pl_p_em_comuniquese',
  PL_P_VALIDACAO_COMUNIQUESE:   'pl_p_validacao_comuniquese',
  PL_P_PROJETO_APROVADO:        'pl_p_projeto_aprovado',
  // Funil Projeto Legal — terminal ordem 14
  PL_PAGAMENTOS:                'pl_pagamentos',
  /** Funil Contabilidade (KANBAN_IDS.CONTABILIDADE) — aberturas ordem 1–3 */
  CONTABILIDADE_INCORPORADORA: 'contabilidade_incorporadora',
  CONTABILIDADE_SPE:           'contabilidade_spe',
  CONTABILIDADE_GESTORA:       'contabilidade_gestora',
  CONTABILIDADE_CONCLUIDO:   'contabilidade_concluido',
  JURIDICO_CONCLUIDO:        'juridico_concluido',
  // Funil Divify / Moní Capital (KANBAN_IDS.MONI_CAPITAL) — fluxo ativo + laterais
  CAPITAL_RECEBIMENTO:            'capital_recebimento',
  CAPITAL_PRIMEIRO_CONTATO:        'capital_primeiro_contato',
  CAPITAL_ABERTURA_SPE:           'capital_abertura_spe',
  CAPITAL_ABERTURA_CONTA:         'capital_abertura_conta',
  CAPITAL_CADASTRO_PLATAFORMA:    'capital_cadastro_plataforma',
  CAPITAL_MATERIAIS_PROJETO:      'capital_materiais_projeto',
  CAPITAL_INFORMACOES_OBRIG:      'capital_informacoes_obrigatorias',
  CAPITAL_PREENCHIMENTO_OFERTA:   'capital_preenchimento_oferta',
  CAPITAL_FORMALIZACAO:           'capital_formalizacao',
  /** Oferta no ar — NÃO é conclusão (migration 556). */
  CAPITAL_OFERTA_PUBLICADA:       'capital_oferta_publicada',
  /**
   * @deprecated slug antigo `capital_concluido` renomeado para `capital_oferta_publicada`.
   * Preferir CAPITAL_OFERTA_PUBLICADA. Alias mantido para refs legadas.
   */
  CAPITAL_CONCLUIDO:              'capital_oferta_publicada',
  /** Etapa de conclusão — dispara capital_ok no card pai. */
  CAPITAL_CAPTACAO_FINALIZADA:    'capital_captacao_finalizada',
  CAPITAL_NAO_ELEGIVEL:           'capital_nao_elegivel',
  // Funil Funding (KANBAN_IDS.FUNDING) — fluxo ordem 1–7
  FUNDING_LEADS:                  'funding_leads',
  FUNDING_R1:                     'funding_r1',
  FUNDING_EVENTO:                 'funding_evento',
  FUNDING_QUALIF:                 'funding_qualif',
  FUNDING_MODELO:                 'funding_modelo',
  FUNDING_DOCS:                   'funding_docs',
  FUNDING_CONTRATO:               'funding_contrato',
  PROJETOS_LOCAIS_CONCLUIDO: 'projetos_locais_concluido',
  PROJETOS_LEGAIS_CONCLUIDO: 'projetos_legais_concluido',
  OPERACOES_ENTREGUE:        'operacoes_entregue',
  // Gates
  STEP_5:             'step_5',
  CTO_CONDICOES_PRECEDENTES: 'cto_condicoes_precedentes',
  STEP_6:             'step_6',
  /** Funil Portfólio — fase Opção (confirmação migration 389). Legado PROD: `step_3`. */
  OPCAO:              'opcao',
  // Funil Step One (KANBAN_IDS.STEP_ONE) — fluxo ordem 1–13 (PROD)
  ONBOARDING:           'onboarding',
  DADOS_CANDIDATO:      'dados_candidato',
  DADOS_CIDADE:         'dados_cidade',
  MAPA_COMPETIDORES:    'mapa_competidores',
  DADOS_CONDOMINIOS:    'dados_condominios',
  LOTES_DISPONIVEIS:    'lotes_disponiveis',
  BATALHA:              'batalha', // coluna «Pré Batalha»
  /** @deprecated Slug legado — fase absorvida por `batalha`. */
  PRE_BATALHA:          'pre_batalha',
  CONFIGURADOR_CASAS:   'configurador_casas',
  BCA:                  'bca',
  /** Slug legado renomeado — valor canônico PROD: `bca`. */
  BCA_BATALHA_CASAS:    'bca',
  BATALHA_CASAS:        'batalha_casas',
  ESCOLHA:              'escolha',
  HIPOTESES:            'hipoteses',
  // Funil Motor 01 (KANBAN_IDS.MOTOR01) — bastões de ida
  M1_EXECUCAO_CASA:     'm1_execucao_casa',
  M1_AJUSTES:           'm1_ajustes',
  M1_R04_AJUSTES:       'm1_r04_ajustes',
  M1_CTO_CLIENTE:       'm1_cto_cliente',
  M1_PAGAMENTO_ENTRADA: 'm1_pagamento_entrada',
  M1_CUSTOM_TRACK1_2:   'm1_custom_track1_2',
  // Funil Homologações (KANBAN_IDS.HDM_HOMOLOGACOES) — fluxo ordem 1–4
  HOMOLOG_NOVAS_HOMOLOGACOES:     'homolog_novas_homologacoes',
  HOMOLOG_BUSCAR_FORNECEDORES:    'homolog_buscar_fornecedores',
  HOMOLOG_DEFINIR_COMPOSICAO:     'homolog_definir_composicao',
  /** Terminal / conversão — dispara aviso de saída para Waysers/Produto/MV/Acoplamento. */
  HOMOLOG_CRIAR_PRODUTO_DATABASE: 'homolog_criar_produto_database',
  /** @deprecated Fases legadas desativadas na migration 462. */
  HOM_CANDIDATURA:  'hom_candidatura',
  /** @deprecated migration 462 */
  HOM_DOCUMENTACAO: 'hom_documentacao',
  /** @deprecated migration 462 */
  HOM_TECNICA:      'hom_tecnica',
  /** @deprecated migration 462 */
  HOM_NEGOCIACAO:   'hom_negociacao',
  /** @deprecated migration 462 */
  HOM_APROVADO:     'hom_aprovado',
  /** @deprecated migration 462 */
  HOM_REPROVADO:    'hom_reprovado',

  MKT_GRAV_PLANEJAMENTO: 'mkt_grav_planejamento',
  MKT_GRAV_IN_LOCO: 'mkt_grav_in_loco',
  MKT_GRAV_DECUPAGEM: 'mkt_grav_decupagem',
  MKT_PROG_PLANEJAMENTO: 'mkt_prog_planejamento',
  MKT_PROG_EDICAO: 'mkt_prog_edicao',
  MKT_PROG_AGENDAMENTO: 'mkt_prog_agendamento',
  MKT_INC_PLANEJAMENTO: 'mkt_inc_planejamento',
  MKT_INC_GRAVACAO: 'mkt_inc_gravacao',
  MKT_INC_DECUPAGEM: 'mkt_inc_decupagem',
  MKT_INC_D1_STORYLINE: 'mkt_inc_d1_storyline',
  MKT_INC_D2_ROTEIRO: 'mkt_inc_d2_roteiro',
  MKT_INC_D21_EXTRA: 'mkt_inc_d21_extra',
  MKT_INC_D3_EDICAO: 'mkt_inc_d3_edicao',
  MKT_INC_D4_FINAL: 'mkt_inc_d4_final',

  CARE_NOVO_ACIONAMENTO: 'care_novo_acionamento',
  CARE_TRIAGEM: 'care_triagem',
  CARE_AGENDAMENTO: 'care_agendamento',
  CARE_VISITA_CONFIRMADA: 'care_visita_confirmada',
  CARE_EM_ATENDIMENTO: 'care_em_atendimento',
  CARE_ORCAMENTO: 'care_orcamento',
  CARE_AGUARDANDO_APROVACAO: 'care_aguardando_aprovacao',
  CARE_EM_EXECUCAO: 'care_em_execucao',
  CARE_CONCLUIDO: 'care_concluido',
  CARE_ARQUIVADO: 'care_arquivado',

  // Funil Modelo Virtual (KANBAN_IDS.HDM_MODELO_VIRTUAL) — fluxo ordem 1–10
  MV_MODELAGEM_CASA: 'mv_modelagem_casa',
  MV_MODELAGEM_INFRA: 'mv_modelagem_infra',
  /** Fase de espera externa — aguardando projeto da Boss Panel (~3 semanas) */
  MV_AGUARDAR_BOSS: 'mv_aguardar_boss',
  /** Compatibilização estrutural com Boss Panel — pode repetir N vezes */
  MV_COMPAT_ESTRUTURA: 'mv_compat_estrutura',
  /** Compatibilização de infra com Mtechne — pode repetir N vezes */
  MV_COMPAT_INFRA: 'mv_compat_infra',
  /** Docs: esquadrias, LightWall, cimentícia, revestimento ext., brises */
  MV_DOC_FASE1: 'mv_doc_fase1',
  /** Docs: estrutura cobertura, forro, piso, layout, deck */
  MV_DOC_FASE2: 'mv_doc_fase2',
  /** Docs: estrutura casa, escada, parede Boss Panel, MDF, revestimentos int. */
  MV_DOC_FASE3: 'mv_doc_fase3',
  /** Docs: louças, metais, marmoraria, marcenaria, box e espelhos */
  MV_DOC_FASE4: 'mv_doc_fase4',
  MV_CONCLUIDO: 'mv_concluido',

  // Funil Corretores (KANBAN_IDS.CORRETORES) — fluxo ordem 1–8
  COR_OPORTUNIDADE: 'cor_oportunidade',
  COR_PRIMEIRO_CONTATO: 'cor_primeiro_contato',
  COR_AGENDAMENTO: 'cor_agendamento',
  COR_VISITA_REALIZADA: 'cor_visita_realizada',
  COR_PROPOSTA_ENVIADA: 'cor_proposta_enviada',
  COR_FORECAST: 'cor_forecast',
  /** Fase terminal de ganho — card arquivado como convertido */
  COR_CONVERTIDO: 'cor_convertido',
  /** Fase terminal de perda — motivo obrigatório */
  COR_PERDIDO: 'cor_perdido',
} as const

/** Funil Corretores — confirmação ao sair de Forecast para Convertido. */
export const CORRETORES_FASES_CONFIRMACAO_SAIDA = {
  forecast: [FASE_SLUGS.COR_FORECAST],
} as const;

/** Funil Portfólio — slugs que disparam confirmação ao sair da fase (migration 389). */
export const PORTFOLIO_FASES_CONFIRMACAO_SAIDA = {
  opcao: [FASE_SLUGS.OPCAO, FASE_SLUGS.STEP_3],
  comite: [FASE_SLUGS.STEP_5],
  contrato: [FASE_SLUGS.STEP_7],
} as const;

/** Funil Loteadores — slugs que disparam popup ao sair da fase (Assinou? / Comitê). */
export const LOTEADORES_FASES_CONFIRMACAO_SAIDA = {
  opcao: [FASE_SLUGS.LOTEADORES_OPCAO],
  comite: [FASE_SLUGS.LOTEADORES_COMITE],
  cto_precedentes: [FASE_SLUGS.LOTEADORES_CTO_PRECEDENTES],
  cto_showroom: [FASE_SLUGS.LOTEADORES_CTO_SHOWROOM],
  cto_parceria: [FASE_SLUGS.LOTEADORES_CONTRATO_PARCERIA],
} as const;

/** Set Up (Step One), Portfólio, Loteadores e Pré Obra e Obra — vínculo manual para qualquer funil destino.
 *  (IDs de kanban — não é lista de fases. Ordem canônica das fases Loteadores: `LOTEADORES_FASES_CANONICAS`.)
 */
export const KANBANS_VINCULO_MANUAL_LIVRE = [
  KANBAN_IDS.STEP_ONE,
  KANBAN_IDS.PORTFOLIO,
  KANBAN_IDS.LOTEADORES,
  KANBAN_IDS.OPERACOES,
] as const;

// Kanbans onde Frank podia abrir chamado jurídico manualmente (funil desativado — vazio)
export const KANBANS_COM_CHAMADO_JURIDICO = [] as const;

// Kanbans desativados ou ocultos (apenas Funil Jurídico — rota redireciona ao hub).
export const KANBANS_INTERNOS = [KANBAN_IDS.JURIDICO] as const;

/** Nomes em `kanbans.nome` alinhados a `KANBANS_INTERNOS`. */
export const KANBANS_INTERNOS_NOMES = ['Funil Jurídico'] as const;

export const MSG_CHAMADO_JURIDICO_JA_EXISTE =
  'Já existe um chamado jurídico aberto para este card';
