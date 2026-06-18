import type { SlaKanbanResult } from '@/lib/kanban/kanban-card-sla';

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

export type PipelineCardsViewMode = 'franqueadora' | 'unidade';

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
  unidadesComCardsAtivos: number;
  cardsAtivos: number;
  cardsAtrasados: number;
  cardsSemMovimentacao: number;
  cardsVencendoEmBreve: number;
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
  cardsPorFunil: PipelineCardsKpisFunil[];
};

export type PipelineCardsGrupo = {
  id: string;
  label: string;
  sublabel?: string;
  cards: PipelineCardDisplay[];
};

export type PipelineCardsDataset = {
  cards: PipelineCardRow[];
  franqueados: PipelineFranqueadoUnidade[];
};
