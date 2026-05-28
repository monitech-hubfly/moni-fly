// IDs consultados diretamente do banco PROD — não alterar manualmente
export const KANBAN_IDS = {
  STEP_ONE:      '4d89f111-cef6-48aa-93ff-72d6406f0a32',
  PORTFOLIO:     'c57120a0-991c-422b-8def-4d16a9411d45',
  ACOPLAMENTO:   '15847602-231d-4937-a06f-82027eb87ef3',
  CONTABILIDADE: '26d1c83c-988e-40d7-8b78-470801b99c1f',
  CREDITO:       '6463af1d-850d-4958-b74c-404f8d668e21',
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
  'Funil Crédito': KANBAN_IDS.CREDITO,
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
  // Crédito — bastão de volta
  CREDITO_TERRENO_APROVADO:  'b1c22353-f20b-4545-9548-5328c253bd99',
  CREDITO_TERRENO_REPROVADO: '92bc0cab-e8b6-4199-9066-7fbea8d600a2',
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
  PROJETO_LEGAL:      'projeto_legal',
  LOTEADOR_JURIDICO:  'loteador_juridico',
  // Gatilhos de VOLTA
  ACOPLAMENTO_APROVADO:      'acoplamento_aprovado',
  ACOPLAMENTO_REPROVADO:     'acoplamento_reprovado',
  CREDITO_TERRENO_APROVADO:  'credito_terreno_aprovado',
  CREDITO_TERRENO_REPROVADO: 'credito_terreno_reprovado',
  CREDITO_OBRA_APROVADO:     'credito_obra_aprovado',
  CREDITO_OBRA_REPROVADO:    'credito_obra_reprovado',
  CONTABILIDADE_CONCLUIDO:   'contabilidade_concluido',
  JURIDICO_CONCLUIDO:        'juridico_concluido',
  CAPITAL_CONCLUIDO:         'capital_concluido',
  CAPITAL_NAO_ELEGIVEL:      'capital_nao_elegivel',
  PROJETOS_LOCAIS_CONCLUIDO: 'projetos_locais_concluido',
  PROJETOS_LEGAIS_CONCLUIDO: 'projetos_legais_concluido',
  // Gates
  STEP_5:             'step_5',
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
