import type { PainelColumnKey } from '@/app/steps-viabilidade/painelColumns';

/** Etapas consideradas “operação” no dashboard (exclui contabilidade). */
export const ETAPAS_OPERACAO_DASHBOARD: ReadonlySet<PainelColumnKey> = new Set([
  'passagem_wayser',
  'planialtimetrico',
  'sondagem',
  'projeto_legal',
  'aprovacao_condominio',
  'aprovacao_prefeitura',
  'revisao_bca',
  'processos_cartorarios',
  'aguardando_credito',
  'em_obra',
  'moni_care',
  'credito_terreno',
  'credito_obra',
]);

export function isEtapaOperacaoDashboard(etapa: PainelColumnKey | string): boolean {
  return ETAPAS_OPERACAO_DASHBOARD.has(etapa as PainelColumnKey);
}

/**
 * Cancelamento exige motivo de reprovação em comitê quando:
 * - ainda não há aprovação em comitê (pré-comitê), ou
 * - há aprovação mas o card ainda não está na faixa “operação” (pré-operação pós-comitê).
 */
export function precisaMotivoReprovacaoComiteNoCancelamento(
  comiteAprovado: boolean,
  etapaPainel: PainelColumnKey | string,
): boolean {
  if (!comiteAprovado) return true;
  if (isEtapaOperacaoDashboard(etapaPainel)) return false;
  return true;
}

/** Etapas do fluxo principal do Kanban Novos Negócios (exclui só contábil e crédito dedicados). */
export const ETAPAS_KANBAN_NN: ReadonlySet<PainelColumnKey> = new Set([
  'step_1',
  'step_2',
  'aprovacao_moni_novo_negocio',
  'step_3',
  'step_4',
  'acoplamento',
  'step_5',
  'step_6',
  'step_7',
  'passagem_wayser',
  'planialtimetrico',
  'sondagem',
  'projeto_legal',
  'aprovacao_condominio',
  'aprovacao_prefeitura',
  'revisao_bca',
  'processos_cartorarios',
  'aguardando_credito',
  'em_obra',
  'moni_care',
]);

export function isEtapaKanbanNovosNegocios(etapa: PainelColumnKey | string): boolean {
  return ETAPAS_KANBAN_NN.has(etapa as PainelColumnKey);
}
