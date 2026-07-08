/** Regras genéricas de justificativa de quebra de SLA — todos os kanbans e fases. */

export function faseTemSlaConfigurado(sla_dias?: number | null): boolean {
  return sla_dias != null && sla_dias > 0;
}

export function slaFaseEstaAtrasado(slaStatus: 'ok' | 'atencao' | 'atrasado'): boolean {
  return slaStatus === 'atrasado';
}

export function isMovimentoParaFasePosterior(fromOrdem: number, toOrdem: number): boolean {
  return toOrdem > fromOrdem;
}

/** Modal ao avançar — SLA vencido com prazo configurado na fase de origem. */
export function deveExibirModalJustificativaSla(input: {
  slaStatus: 'ok' | 'atencao' | 'atrasado';
  sla_dias?: number | null;
  movimentoPosterior: boolean;
}): boolean {
  if (!input.movimentoPosterior) return false;
  if (!faseTemSlaConfigurado(input.sla_dias)) return false;
  return slaFaseEstaAtrasado(input.slaStatus);
}

/** Texto novo é obrigatório apenas quando ainda não há justificativa na fase. */
export function justificativaSlaObrigatoria(justificativaExistente?: string | null): boolean {
  return !String(justificativaExistente ?? '').trim();
}

/** Bloqueia avanço sem justificativa registrada para a fase atual. */
export function cardPrecisaJustificativaSla(input: {
  slaStatus: 'ok' | 'atencao' | 'atrasado';
  sla_dias?: number | null;
  justificativaExistente?: string | null;
  movimentoPosterior: boolean;
}): boolean {
  if (!deveExibirModalJustificativaSla(input)) return false;
  return justificativaSlaObrigatoria(input.justificativaExistente);
}

export const MSG_GATE_JUSTIFICATIVA_SLA =
  'O SLA desta fase está vencido. Registre a justificativa da quebra de SLA antes de mover o card.';
