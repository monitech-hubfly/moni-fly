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
  CONTRATACOES:  '5f40aa71-8156-423b-baa8-e3512e308c04',
  HDM_PRODUTO:         'a9e61d76-0461-4644-80c7-3ca50cbe4e9f',
  HDM_MODELO_VIRTUAL:  '92d0033b-fd8c-432d-a089-e78c41a7cf48',
  HDM_HOMOLOGACOES:    '69bf5668-7749-476a-a834-962a0bb0eef7',
  PROJETO_LEGAL:   '39de341d-aebf-481c-9118-ce6fc6574187',
  PROJETOS_LOCAIS: 'c2ab09bd-4bd6-491e-8734-281d7678a6ad',
  PROJETOS_LEGAIS: '23ad5ce1-59f8-4e74-acb8-69aa61228cd8',
} as const

/** `kanbans.nome` → UUID canônico (PROD). Preferir na resolução do board. */
export const KANBAN_ID_BY_NOME: Record<string, string> = {
  'Funil Step One': KANBAN_IDS.STEP_ONE,
  'Funil Portfólio': KANBAN_IDS.PORTFOLIO,
  'Funil Acoplamento': KANBAN_IDS.ACOPLAMENTO,
  'Funil Contabilidade': KANBAN_IDS.CONTABILIDADE,
  'Funil Crédito Obra': KANBAN_IDS.CREDITO_OBRA,
  'Funil Loteadores': KANBAN_IDS.LOTEADORES,
  'Funil Operações': KANBAN_IDS.OPERACOES,
  'Funil Jurídico': KANBAN_IDS.JURIDICO,
  'Funil Moní Capital': KANBAN_IDS.MONI_CAPITAL,
  'Funil Contratações': KANBAN_IDS.CONTRATACOES,
  'Funil Produto': KANBAN_IDS.HDM_PRODUTO,
  'Funil Modelo Virtual': KANBAN_IDS.HDM_MODELO_VIRTUAL,
  'Funil Homologações': KANBAN_IDS.HDM_HOMOLOGACOES,
  'Funil Projeto Legal': KANBAN_IDS.PROJETO_LEGAL,
  'Funil Projetos Locais': KANBAN_IDS.PROJETOS_LOCAIS,
  'Funil Projetos Legais': KANBAN_IDS.PROJETOS_LEGAIS,
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
  // Funil Crédito Obra — terminais ordem 24–25 (bastão de volta)
  CREDITO_OBRA_APROVADO:     'da6b7ed6-3137-42aa-9cc7-0d3aec4e6cfd',
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
  /** Funil Acoplamento — gate Gbox/Acoplamento antes de avançar. */
  MODELAGEM_CASA_GBOX: 'modelagem_casa_gbox',
  APROVACAO_PREFEITURA: 'aprovacao_prefeitura',
  PROJETO_LEGAL:      'projeto_legal',
  LOTEADOR_JURIDICO:  'loteador_juridico',
  // Gatilhos de VOLTA
  ACOPLAMENTO_APROVADO:      'acoplamento_aprovado',
  ACOPLAMENTO_REPROVADO:     'acoplamento_reprovado',
  // Funil Crédito Obra (KANBAN_IDS.CREDITO_OBRA) — fluxo ordem 1–23
  CO_NOVO_PROJETO:            'co_novo_projeto',
  CO_ENVIO_CASHME:            'co_envio_cashme',
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
  CO_SHAREPOINT_3A:           'co_sharepoint_3a',
  CO_ACOMPANHAMENTO_3A:       'co_acompanhamento_3a',
  CO_NECESSIDADE_4A_TRANCHE:  'co_necessidade_4a_tranche',
  CO_SHAREPOINT_4A:           'co_sharepoint_4a',
  CO_ACOMPANHAMENTO_4A:       'co_acompanhamento_4a',
  CO_NECESSIDADE_5A_TRANCHE:  'co_necessidade_5a_tranche',
  CO_SHAREPOINT_5A:           'co_sharepoint_5a',
  CO_ACOMPANHAMENTO_5A:       'co_acompanhamento_5a',
  CO_NECESSIDADE_6A_TRANCHE:  'co_necessidade_6a_tranche',
  CO_SHAREPOINT_6A:           'co_sharepoint_6a',
  CO_ACOMPANHAMENTO_6A:       'co_acompanhamento_6a',
  // Funil Crédito Obra — terminais ordem 24–25
  CREDITO_OBRA_APROVADO:      'credito_obra_aprovado',
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
  CONTABILIDADE_CONCLUIDO:   'contabilidade_concluido',
  JURIDICO_CONCLUIDO:        'juridico_concluido',
  CAPITAL_CONCLUIDO:         'capital_concluido',
  CAPITAL_NAO_ELEGIVEL:      'capital_nao_elegivel',
  PROJETOS_LOCAIS_CONCLUIDO: 'projetos_locais_concluido',
  PROJETOS_LEGAIS_CONCLUIDO: 'projetos_legais_concluido',
  OPERACOES_ENTREGUE:        'operacoes_entregue',
  // Gates
  STEP_5:             'step_5',
  // Funil Step One (KANBAN_IDS.STEP_ONE) — fluxo ordem 1–11 (PROD)
  DADOS_CANDIDATO:      'dados_candidato',
  DADOS_CIDADE:         'dados_cidade',
  LISTA_CONDOMINIOS:    'lista_condominios',
  DADOS_CONDOMINIOS:    'dados_condominios',
  LOTES_DISPONIVEIS:    'lotes_disponiveis',
  MAPA_COMPETIDORES:    'mapa_competidores',
  PRE_BATALHA:          'pre_batalha',
  ESCOLHA:              'escolha',
  BCA:                  'bca',
  /** Slug legado renomeado — valor canônico PROD: `bca`. */
  BCA_BATALHA_CASAS:    'bca',
  BATALHA:              'batalha',
  HIPOTESES:            'hipoteses',
} as const

// Kanbans onde Frank pode abrir chamado jurídico manualmente
export const KANBANS_COM_CHAMADO_JURIDICO = [
  KANBAN_IDS.PORTFOLIO,
  KANBAN_IDS.LOTEADORES,
  KANBAN_IDS.OPERACOES,
] as const

// Kanbans que Frank NÃO deve ver (filtros, esteiras paralelas, etc.)
export const KANBANS_INTERNOS = [
  KANBAN_IDS.JURIDICO,
  KANBAN_IDS.MONI_CAPITAL,
  KANBAN_IDS.CONTRATACOES,
  KANBAN_IDS.HDM_PRODUTO,
  KANBAN_IDS.HDM_MODELO_VIRTUAL,
  KANBAN_IDS.HDM_HOMOLOGACOES,
  KANBAN_IDS.PROJETO_LEGAL,
  KANBAN_IDS.PROJETOS_LOCAIS,
  KANBAN_IDS.PROJETOS_LEGAIS,
] as const;

/** Nomes em `kanbans.nome` alinhados a `KANBANS_INTERNOS`. */
export const KANBANS_INTERNOS_NOMES = [
  'Funil Jurídico',
  'Funil Moní Capital',
  'Funil Contratações',
  'Funil Produto',
  'Funil Modelo Virtual',
  'Funil Homologações',
  'Funil Projeto Legal',
  'Funil Projetos Locais',
  'Funil Projetos Legais',
] as const;

export const MSG_CHAMADO_JURIDICO_JA_EXISTE =
  'Já existe um chamado jurídico aberto para este card';
