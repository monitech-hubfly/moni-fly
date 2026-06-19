import type { SlaKanbanResult } from '@/lib/kanban/kanban-card-sla';
import type {
  GargaloScoreFase,
  PainelChamadoUnificadoDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
} from '@/lib/kanban/painel-performance-types';

/** Card enriquecido para o painel — campos derivados do kanban/fase reais (sem duplicata manual). */
export type PipelineCardRow = {
  id: string;
  titulo: string;
  kanban_id: string;
  kanban_nome: string;
  fase_id: string;
  fase_nome: string;
  fase_slug: string | null;
  fase_ordem: number;
  fase_sla_dias: number | null;
  /** Admin: fase marcada como conversão (migration 387). */
  fase_conversao: boolean;
  rede_franqueado_id: string | null;
  n_franquia: string | null;
  franqueado_nome: string | null;
  rede_ordem: number;
  created_at: string;
  updated_at: string;
  entered_fase_at: string | null;
  sla_iniciado_em: string | null;
  alvara_url: string | null;
  docs_terreno_url: string | null;
  arquivado: boolean;
  concluido: boolean;
  origem: 'nativo';
  responsavel_fase_id?: string | null;
  responsavel_fase_nome?: string | null;
  contrato_assinado?: boolean;
  contrato_assinado_em?: string | null;
  opcao_assinada?: boolean;
  opcao_assinada_em?: string | null;
  comite_aprovado?: boolean;
  comite_aprovado_em?: string | null;
  /** Funil Operações — migration 393. */
  prefeitura_aprovada?: boolean;
  prefeitura_aprovada_em?: string | null;
  obra_iniciada?: boolean;
  obra_iniciada_em?: string | null;
  obra_finalizada?: boolean;
  obra_finalizada_em?: string | null;
  /** FK `projeto_negocio.id` — agrupa esteiras paralelas do mesmo negócio. */
  projeto_id?: string | null;
  projeto_titulo?: string | null;
};

export type PipelineFranqueadoUnidade = {
  rede_franqueado_id: string;
  n_franquia: string | null;
  franqueado_nome: string | null;
  ordem: number;
};

export type PipelineCardDisplay = PipelineCardRow & {
  sla: SlaKanbanResult;
  /** Dias corridos desde `updated_at` (inatividade operacional). */
  diasSemMovimento: number;
  inativo: boolean;
};

export type PipelineGroupBy = 'franquia' | 'fase' | 'funil' | 'status';

/** `rede` é alias de `franqueadora` (visão consolidada da rede). */
export type PipelineCardsViewMode = 'franqueadora' | 'rede' | 'unidade';

export type PipelineCardsStatusFiltro =
  | 'todos'
  | 'atrasados'
  | 'vence_hoje'
  | 'vencendo_breve'
  | 'sem_movimentacao'
  | 'dentro_prazo';

export type PipelineCardsFiltros = {
  busca: string;
  unidade: 'todas' | string;
  kanban: 'todos' | string;
  fase: 'todas' | string;
  status: PipelineCardsStatusFiltro;
  responsavel: 'todos' | string;
};

export const PIPELINE_CARDS_FILTROS_DEFAULT: PipelineCardsFiltros = {
  busca: '',
  unidade: 'todas',
  kanban: 'todos',
  fase: 'todas',
  status: 'todos',
  responsavel: 'todos',
};

export type PipelineCardsKpis = {
  cardsAtivos: number;
  cardsAtrasados: number;
  cardsSemMovimentacao: number;
  cardsVencendoEmBreve: number;
  gargalosCriticos: number;
  chamadosComTrava: number;
};

export type PipelineFranqueadoraEnrichment = {
  fases: PainelFaseDTO[];
  /** Usado só no servidor (gargalo); removido antes de serializar ao client. */
  historicoMovimentos?: PainelHistoricoMovimentoDTO[];
  chamados: PainelChamadoUnificadoDTO[];
  gargaloRanking: GargaloScoreFase[];
  maxOrdemPorKanban: Record<string, number>;
};

export type PipelineCardsKpisFunil = {
  kanbanId: string;
  kanbanNome: string;
  total: number;
};

export type PipelineCardsKpisUnidade = {
  cardsAtivos: number;
  cardsAtrasados: number;
  cardsSemMovimentacao: number;
  proximosVencimentos: number;
  funisAtivos: number;
  chamadosComTrava: number;
  cardsPorFunil: PipelineCardsKpisFunil[];
};

export type PipelineOQueFazerItem = {
  cardId: string;
  titulo: string;
  fase: string;
  kanbanNome: string;
  acao: string;
  prioridade: number;
  href: string;
};

export type PipelineFunilGrupoUnidade = {
  kanbanId: string;
  kanbanNome: string;
  cards: PipelineCardDisplay[];
  defaultExpanded: boolean;
};

export type PipelineProjetoGrupoUnidade = {
  projetoId: string;
  projetoTitulo: string;
  cards: PipelineCardDisplay[];
  defaultExpanded: boolean;
};

export type PipelineUnidadeDisplayBloco =
  | { tipo: 'projeto'; grupo: PipelineProjetoGrupoUnidade }
  | { tipo: 'solo'; card: PipelineCardDisplay };

export type PipelineCardsGrupo = {
  id: string;
  label: string;
  sublabel?: string;
  cards: PipelineCardDisplay[];
};

export type PipelineCardsDataset = {
  cards: PipelineCardRow[];
  franqueados: PipelineFranqueadoUnidade[];
  /** Dados extras para visão franqueadora / aba Análises (degrada se ausente). */
  enrichment?: PipelineFranqueadoraEnrichment | null;
};

export type PipelineCardBadgeStatus = 'atrasado' | 'alerta' | 'parado' | 'em_dia';

export type PipelineUnidadeSaudeMes = {
  entradasMes: number;
  contratosMes: number;
  metaEntradas: number;
  metaContratos: number;
};

export type PipelineUnidadeAlertas = {
  atrasados: number;
  parados: number;
  chamadosTrava: number;
  venceEm2Dias: number;
  nivel: 'critico' | 'atencao' | 'ok';
};

export type PipelineFunilMesDotNivel = 0 | 1 | 2 | 3 | 4 | 5;

export type PipelineFunilMesUnidadeRow = {
  redeId: string;
  label: string;
  quantidade: number;
  dots: PipelineFunilMesDotNivel;
};

export type PipelineFunilMesBarSegment = {
  redeId: string;
  label: string;
  quantidade: number;
  pct: number;
  cor: string;
};

export type PipelineFunilMesEtapaKey =
  | 'hipoteses'
  | 'opcoes'
  | 'comites'
  | 'contratos'
  | 'aprovacoes'
  | 'obras_iniciadas'
  | 'obras_finalizadas';

export type PipelineFunilMesColuna = {
  key: PipelineFunilMesEtapaKey;
  label: string;
  total: number;
  /** Quando campos Operações não estão no fetch — exibir "—". */
  totalIndisponivel?: boolean;
  /** Unidades com quantidade > 0 no mês, ordenadas decrescente. */
  porUnidade: PipelineFunilMesUnidadeRow[];
  /** Unidades elegíveis com quantidade 0 (expandíveis via "ver todas"). */
  porUnidadeZeradas: PipelineFunilMesUnidadeRow[];
  barSegments: PipelineFunilMesBarSegment[];
};

export type PipelineFunilMesRede = {
  colunas: PipelineFunilMesColuna[];
  conversoes: (number | null)[];
  disponivel: boolean;
};

export type PipelineFunilMesUnidadeMetric = {
  key: PipelineFunilMesEtapaKey;
  label: string;
  total: number;
  totalIndisponivel?: boolean;
  dots: PipelineFunilMesDotNivel;
  dotCor: 'verde' | 'vermelho' | 'cinza';
};

export type PipelineFunilMesUnidade = {
  metricas: PipelineFunilMesUnidadeMetric[];
  conversoes: (number | null)[];
  disponivel: boolean;
};

export type PipelineFunilMesCompact = {
  hipoteses: number;
  opcoes: number;
  comites: number;
  contratos: number;
  aprovacoes: number;
  obrasIniciadas: number;
  obrasFinalizadas: number;
};

export type PipelineUnidadeBlocoMeta = {
  redeId: string;
  label: string;
  nFranquia: string | null;
  alertas: PipelineUnidadeAlertas;
  saude: PipelineUnidadeSaudeMes;
  funilMes: PipelineFunilMesCompact;
  defaultExpanded: boolean;
  sortPriority: number;
};
