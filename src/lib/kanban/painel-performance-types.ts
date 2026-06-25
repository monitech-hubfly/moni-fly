export type PainelFaseDTO = {
  id: string;
  nome: string;
  ordem: number;
  sla_dias: number | null;
  sla_tipo?: 'uteis' | 'corridos' | null;
  fase_conversao: boolean;
  slug?: string | null;
};

export type PainelCardDTO = {
  id: string;
  titulo: string;
  fase_id: string;
  created_at: string;
  updated_at: string;
  entered_fase_at: string | null;
  franqueado_id: string;
  arquivado: boolean;
  arquivado_em: string | null;
  concluido: boolean;
  concluido_em: string | null;
  status: string;
  motivo_arquivamento?: string | null;
  rede_franqueado_id?: string | null;
  n_franquia?: string | null;
  franqueado_rede_nome?: string | null;
  responsavel_fase_id?: string | null;
  responsavel_fase_nome?: string | null;
  /** projeto_negocio.franqueado_id (rede_franqueados) — Carômetro. */
  projeto_franqueado_id?: string | null;
  projeto_n_franquia?: string | null;
  projeto_franqueado_nome?: string | null;
  opcao_assinada?: boolean | null;
  opcao_assinada_em?: string | null;
  comite_aprovado?: boolean | null;
  comite_aprovado_em?: string | null;
  contrato_assinado?: boolean | null;
  contrato_assinado_em?: string | null;
  origem_kanban_id?: string | null;
  origem_kanban_nome?: string | null;
  /** Funil Step One — identificação do lote no card. */
  nome_condominio?: string | null;
  quadra?: string | null;
  lote?: string | null;
  condominio_id?: string | null;
  /** Funil Operações — projeto e praça (rede_franqueados / projeto_negocio). */
  projeto_titulo?: string | null;
  rede_area_atuacao?: string | null;
  rede_cidade_casa_frank?: string | null;
  projeto_rede_area_atuacao?: string | null;
  projeto_rede_cidade_casa_frank?: string | null;
  /** Funil Loteadores — FK `rede_loteadores`. */
  rede_loteador_id?: string | null;
  loteador_nome?: string | null;
  /** Funil Crédito Obra / Operações — FK `projeto_negocio`. */
  projeto_id?: string | null;
};

export type PainelCreditoObraOperacoesIrmaoDTO = {
  projeto_id: string;
  card_id: string;
  fase_id: string;
  entered_fase_at: string | null;
  created_at: string;
  arquivado: boolean;
  concluido: boolean;
};

export type PainelStepOnePortfolioFilhoDTO = {
  origem_card_id: string;
  portfolio_card_id: string;
};

export type PainelCarometroFranquiaCount = {
  franqueadoId: string;
  label: string;
  quantidade: number;
};

export type PainelCarometroIndicadores = {
  opcoes_assinadas_no_periodo: {
    total: number;
    porFranquia: PainelCarometroFranquiaCount[];
  } | null;
  contratos_assinados_no_periodo: {
    total: number;
    porFranquia: PainelCarometroFranquiaCount[];
  } | null;
  comite_para_contrato_taxa: {
    numerador: number;
    denominador: number;
    percentual: number | null;
  } | null;
  hipoteses_no_periodo: {
    total: number;
    porFranquia: PainelCarometroFranquiaCount[];
  } | null;
  acoplamentos_por_origem: Array<{ origem: string; quantidade: number }> | null;
};

export type PainelAtividadeDTO = {
  id: string;
  card_id: string;
  titulo: string | null;
  numero: number | null;
  status: string;
  trava: boolean | null;
  tipo: string | null;
  responsavel_id: string | null;
  responsaveis_ids: string[] | null;
  created_at: string;
  data_vencimento: string | null;
};

export type PainelRetrocessoDTO = {
  card_id: string;
  detalhe: {
    fase_anterior_nome?: string;
    fase_nova_nome?: string;
    fase_anterior_id?: string;
    fase_nova_id?: string;
  } | null;
};

export type PainelHistoricoMovimentoDTO = {
  card_id: string;
  acao: string;
  detalhe: Record<string, unknown> | null;
  criado_em: string;
};

export type PainelChamadoUnificadoDTO = {
  dedupeKey: string;
  cardId: string;
  kanbanAtividadeId: string | null;
  sireneChamadoId: number | null;
  titulo: string;
  numero: number | null;
  status: string;
  trava: boolean;
  vencido: boolean;
  aberto: boolean;
  concluido: boolean;
  emPastelaria: boolean;
  responsavelId: string | null;
  responsavelNome: string | null;
  created_at: string;
  data_vencimento: string | null;
  origem: 'kanban_atividade' | 'sirene_card';
};

export type PainelChamadosAnalise = {
  abertos: number;
  concluidos: number;
  vencidos: number;
  comTrava: number;
  emPastelaria: number;
  mediaPorCard: number | null;
  cardsComChamadosAbertos: number;
  cardsComChamadosTrava: number;
  totalChamados: number;
  porFase: Array<{
    faseId: string;
    faseNome: string;
    total: number;
    abertos: number;
    comTrava: number;
    vencidos: number;
  }>;
  porResponsavel: Array<{
    responsavelId: string | null;
    responsavelNome: string;
    total: number;
    abertos: number;
    comTrava: number;
  }>;
  porStatus: Array<{ status: string; total: number }>;
  travaPorFase: Array<{ faseId: string; faseNome: string; total: number }>;
  vencidosPorFase: Array<{ faseId: string; faseNome: string; total: number }>;
  gargaloRelacao: Array<{
    faseId: string;
    faseNome: string;
    gargaloScore: number;
    gargaloClassificacao: GargaloClassificacao;
    chamadosAbertos: number;
    chamadosComTrava: number;
    chamadosVencidos: number;
    ehTopGargalo: boolean;
  }>;
  emGargalo: number;
  destaque: Array<{
    id: string;
    titulo: string;
    numero: number | null;
    cardId: string;
    cardTitulo: string;
    faseNome: string;
    trava: boolean;
    atrasado: boolean;
    status: string;
    emPastelaria: boolean;
    editHref: string | null;
  }>;
};

export type PainelPerformanceDataset = {
  mode: 'nativo' | 'legado';
  kanbanNome: string;
  kanbanId: string;
  fases: PainelFaseDTO[];
  cards: PainelCardDTO[];
  chamados: PainelChamadoUnificadoDTO[];
  retrocessoRows: PainelRetrocessoDTO[];
  historicoMovimentos: PainelHistoricoMovimentoDTO[];
  profiles: Record<string, string>;
  /** Colunas Carômetro (migration 389) disponíveis no fetch de cards. */
  carometroFieldsAvailable?: boolean;
  /** Campos de lote Step One (nome_condominio, quadra, lote) disponíveis no fetch. */
  stepOneFieldsAvailable?: boolean;
  /** Cards Portfólio filhos de cards Step One (`origem_card_id`). */
  portfolioFilhosOrigem?: PainelStepOnePortfolioFilhoDTO[];
  /** false quando a consulta de filhos Portfólio falhou ou não foi feita. */
  portfolioFilhosAvailable?: boolean;
  /** Campos Operações (condomínio, praça via rede/projeto) disponíveis no fetch. */
  operacoesFieldsAvailable?: boolean;
  /** Campo rede_loteador_id + join rede_loteadores disponível no fetch. */
  loteadoresFieldsAvailable?: boolean;
  /** Campo projeto_id disponível no fetch de cards Crédito Obra. */
  creditoObraFieldsAvailable?: boolean;
  /** Cards Operações vinculados ao mesmo projeto_id (cross-funil). */
  operacoesIrmaosPorProjeto?: PainelCreditoObraOperacoesIrmaoDTO[];
  /** Fases do funil Operações para SLA dos cards irmãos. */
  operacoesFases?: PainelFaseDTO[];
  /** false quando a consulta de cards Operações por projeto falhou. */
  operacoesIrmaosAvailable?: boolean;
  /** Campo projeto_id disponível no fetch de cards Contabilidade. */
  contabilidadeFieldsAvailable?: boolean;
  /** Cards Crédito Obra vinculados ao mesmo projeto_id (cross-funil). */
  creditoObraIrmaosPorProjeto?: PainelCreditoObraOperacoesIrmaoDTO[];
  /** Fases do funil Crédito Obra para cruzamento cross-funil. */
  creditoObraFases?: PainelFaseDTO[];
  /** false quando a consulta de cards Crédito Obra por projeto falhou. */
  creditoObraIrmaosAvailable?: boolean;
};

export type PainelPeriodKey = '7d' | '30d' | '90d' | 'all';

export type ConversionFunnelTreeNode = {
  faseId: string;
  faseNome: string;
  ordem: number;
  faseConversao: boolean;
  alcancaram: number;
  pctSobreEntradas: number | null;
  conversaoAnteriorPct: number | null;
  perdaAnteriorPct: number | null;
  tempoMedioDias: number | null;
};

export type ConversionFunnelTreeData = {
  entradasNoFunil: number;
  historicoParcial: boolean;
  nodes: ConversionFunnelTreeNode[];
};

export type GargaloClassificacao = 'baixo' | 'atencao' | 'critico';

export type GargaloMotivoTipo =
  | 'volume'
  | 'atraso'
  | 'inatividade'
  | 'perda_conversao'
  | 'chamados'
  | 'arquivamento'
  | 'arquivamento_sem_motivo';

export type GargaloScoreFase = {
  faseId: string;
  faseNome: string;
  ordem: number;
  faseConversao: boolean;
  score: number;
  classificacao: GargaloClassificacao;
  principalMotivoTipo: GargaloMotivoTipo;
  principalMotivo: string;
  principalMotivoTexto: string;
  cardsNaFase: number;
  cardsAtrasados: number;
  cardsSemMovimentacao: number;
  pctAtrasados: number | null;
  pctSemMovimentacao: number | null;
  chamadosAbertos: number;
  chamadosComTrava: number;
  chamadosAtrasados: number;
  perdaConversaoPct: number | null;
  cardsArquivados: number;
  pctArquivamentoNaFase: number | null;
  arquivamentosSemMotivo: number;
  arquivamentosAntesConversao: number;
};

export type PainelMotivoArquivamentoRow = {
  motivo: string;
  total: number;
  antesConversao: number;
  depoisConversao: number;
};

export type PainelArquivamentoMotivosAnalise = {
  ranking: PainelMotivoArquivamentoRow[];
  porFase: Array<{
    faseId: string;
    faseNome: string;
    ordem: number;
    motivos: PainelMotivoArquivamentoRow[];
  }>;
  porResponsavel: Array<{
    responsavelId: string | null;
    responsavelNome: string;
    motivos: PainelMotivoArquivamentoRow[];
  }>;
  porFranquia: Array<{
    redeFranqueadoId: string;
    label: string;
    motivos: PainelMotivoArquivamentoRow[];
  }>;
  impactoPerdaAntesConversao: PainelMotivoArquivamentoRow[];
  semMotivoInformado: number;
  pctSemMotivo: number | null;
  /** Verdadeiro quando há arquivados sem motivo — sugere tornar obrigatório no modal. */
  sugestaoMotivoObrigatorio: boolean;
};

export type PainelQualidadeMotivoArquivamento = {
  semMotivoInformado: number;
  pctSemMotivo: number;
  totalArquivados: number;
  /** Verdadeiro quando pctSemMotivo &gt; 20% — destaque de atenção no dashboard. */
  alertaAtencao: boolean;
  mensagem: string;
  fasesMaiorSemMotivo: Array<{ faseId: string; faseNome: string; total: number }>;
  responsaveisMaiorSemMotivo: Array<{
    responsavelId: string | null;
    responsavelNome: string;
    total: number;
  }>;
};

export type PainelArquivamentoAnalise = {
  noPeriodo: number;
  antesConversao: number;
  /** Arquivados na fase de conversão (converteu, saiu na conversão). */
  naConversao: number;
  depoisConversao: number;
  taxaArquivamentoPct: number | null;
  cardsAnalisados: number;
  porFase: Array<{
    faseId: string;
    faseNome: string;
    ordem: number;
    total: number;
    antesConversao: number;
    naConversao: number;
    depoisConversao: number;
  }>;
  porResponsavel: Array<{
    responsavelId: string | null;
    responsavelNome: string;
    total: number;
    antesConversao: number;
    naConversao: number;
    depoisConversao: number;
  }>;
  porFranquia: Array<{
    redeFranqueadoId: string;
    label: string;
    total: number;
    antesConversao: number;
    naConversao: number;
    depoisConversao: number;
  }>;
  motivos: PainelArquivamentoMotivosAnalise;
  perdas: PainelPerdasArquivamentos;
  /** Null quando não há arquivados sem motivo no recorte. */
  qualidadeMotivo: PainelQualidadeMotivoArquivamento | null;
};

export type PainelPerdasArquivamentos = {
  totalArquivados: number;
  pctDoPeriodo: number | null;
  antesConversao: number;
  naConversao: number;
  depoisConversao: number;
  principalFaseArquivamento: { faseId: string; faseNome: string; total: number } | null;
  principalMotivoArquivamento: { motivo: string; total: number } | null;
  pctSemMotivo: number | null;
  semMotivoInformado: number;
  /** Arquivados antes da conversão ÷ entradas da coorte (impacto na perda do funil). */
  impactoPerdaConversaoPct: number | null;
  tabelaPorFase: Array<{
    faseId: string;
    faseNome: string;
    ordem: number;
    arquivados: number;
    pctDoTotalArquivado: number | null;
    principalMotivo: string;
    antesConversao: number;
    depoisConversao: number;
  }>;
};

export type PainelPerformanceResult = {
  period: PainelPeriodKey;
  operacao: {
    cardsEntraram: number;
    cardsAtivos: number;
    concluidos: number;
    arquivados: number;
    pctSlaDentro: number | null;
    porFase: Array<{
      faseId: string;
      faseNome: string;
      ordem: number;
      faseConversao: boolean;
      slaDias: number | null;
      cardsAtivos: number;
      cardsArquivados: number;
      atrasados: number;
      diasUteisMedio: number;
    }>;
  };
  arquivamento: PainelArquivamentoAnalise;
  conversao: {
    faseConversaoConfigurada: boolean;
    fasesConversao: Array<{ id: string; nome: string; ordem: number }>;
    entradasNoPeriodo: number;
    chegaramConversao: number;
    taxaConversaoPct: number | null;
    perdaTotalPct: number | null;
    tempoMedioConversaoDias: number | null;
    naConversaoAgora: number;
    arquivadosSemConversao: number;
    arquivadosNaConversao: number;
    arquivadosDepoisConversao: number;
    /** Concluídos em fase anterior à conversão — inconsistência operacional. */
    concluidosInconsistentesAntesConversao: number;
    porFase: Array<{
      faseId: string;
      faseNome: string;
      ordem: number;
      faseConversao: boolean;
      alcancaram: number;
      converteram: number;
      taxaConversaoPct: number | null;
    }>;
    entreFases: Array<{
      deFaseId: string;
      deFaseNome: string;
      paraFaseId: string;
      paraFaseNome: string;
      alcancaramOrigem: number;
      alcancaramDestino: number;
      taxaPassagemPct: number | null;
    }>;
    porResponsavel: Array<{
      responsavelId: string | null;
      responsavelNome: string;
      entradas: number;
      converteram: number;
      taxaConversaoPct: number | null;
    }>;
    porFranquia: Array<{
      redeFranqueadoId: string;
      label: string;
      entradas: number;
      converteram: number;
      taxaConversaoPct: number | null;
    }>;
    funnelTree: ConversionFunnelTreeData;
  };
  gargalos: {
    ranking: GargaloScoreFase[];
    retrocessos: Array<{
      cardId: string;
      titulo: string;
      count: number;
      fasesLabel: string;
    }>;
  };
  chamados: PainelChamadosAnalise;
  insights: PainelInsight[];
  /** KPIs conectáveis ao Carômetro (por funil; null quando não aplicável). */
  carometro: PainelCarometroIndicadores;
};

/** @deprecated Use PainelPerformanceResult */
export type PainelAnaliseResult = PainelPerformanceResult;

export type PainelInsightTipo =
  | 'atrasos_concentrados'
  | 'conversao_destaque'
  | 'tempo_medio_variacao'
  | 'oportunidades_concentradas'
  | 'chamados_gargalo'
  | 'inatividade_critica'
  | 'arquivamento_perda_funil'
  | 'arquivamento_concentracao_fase'
  | 'arquivamento_sem_motivo'
  | 'arquivamento_taxa_unidade'
  | 'arquivamento_motivo_frequente'
  | 'arquivamento_tempo_medio_fase'
  | 'arquivamento_pos_conversao'
  | 'arquivamento_motivo_perda';

export type PainelInsight = {
  tipo: PainelInsightTipo;
  tipoLabel: string;
  relevancia: number;
  texto: string;
};

export type PainelArquivadoDrawerRow = {
  cardId: string;
  titulo: string;
  funilNome: string;
  faseArquivamentoNome: string;
  arquivadoEm: string | null;
  momentoConversao: 'antes' | 'na_conversao' | 'depois' | 'indeterminado';
  momentoConversaoLabel: string;
  classificacaoRotulo: string;
  motivo: string;
  responsavelNome: string;
  unidadeLabel: string | null;
  openHref: string;
};
