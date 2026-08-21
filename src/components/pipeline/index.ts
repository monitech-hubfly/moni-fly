export { PipelineCardsView, type PipelineCardsViewProps } from '@/components/pipeline/PipelineCardsView';
export { PipelineEsteiraTable, type PipelineEsteiraTableProps } from '@/components/pipeline/PipelineEsteiraTable';
export { PipelineCardMiniDrawer } from '@/components/pipeline/PipelineCardMiniDrawer';
export { PipelineProgressBar, type PipelineProgressBarProps } from '@/components/pipeline/PipelineProgressBar';
export { PipelineProgressCard, type PipelineProgressCardProps } from '@/components/pipeline/PipelineProgressCard';
export {
  PIPELINE_READONLY_NOTA,
  slaKanbanCardFromPipelineRow,
  dataEntradaFaseAtualKanbanCard,
  formatDataEntradaFaseAtualKanbanCard,
  calcularDiasNaFase,
  sincronizarLinhaFaseAtualComCard,
} from '@/lib/kanban/pipeline-card-readonly';
export { fetchPipelineCards, type FetchPipelineCardsOpts } from '@/lib/kanban/fetch-pipeline-cards';
export {
  loadPipelineCardDrawerData,
  labelUnidadePipelineDrawer,
  type PipelineCardDrawerData,
  type PipelineDrawerFaseHistorico,
  type PipelineDrawerChamadoSirene,
} from '@/lib/kanban/load-pipeline-card-drawer';
export {
  ESTEIRA_PRINCIPAL_ETAPAS,
  indiceEstagioEsteiraPrincipal,
  isFunilEsteiraPrincipal,
} from '@/lib/kanban/pipeline-esteira-principal';
export {
  montarPipelineProgressCardMeta,
  montarProgressoEsteiraPrincipal,
  statusOperacionalPipeline,
  type PipelineEsteiraProgresso,
  type PipelineProgressCardMeta,
  type PipelineStatusOperacional,
} from '@/lib/kanban/pipeline-progress-utils';
export type {
  PipelineCardRow,
  PipelineCardDisplay,
  PipelineCardsDataset,
  PipelineFranqueadoUnidade,
  PipelineGroupBy,
  PipelineCardsViewMode,
  PipelineCardsFiltros,
  PipelineCardsGrupo,
  PipelineEsteiraHistoricoEvento,
  PipelineEsteiraHistoricoPorCard,
} from '@/lib/kanban/pipeline-cards-types';
export {
  ESTEIRA_COLUNAS,
  computarDatasEsteira,
  extrairHistoricoDeSaida,
  resolverColunaEsteira,
} from '@/lib/kanban/pipeline-esteira-datas';
export {
  enriquecerPipelineCard,
  agruparPipelineCards,
  filtrarPipelineCards,
  labelFranqueadoPipeline,
  PIPELINE_INATIVIDADE_DIAS,
} from '@/lib/kanban/pipeline-cards-utils';
