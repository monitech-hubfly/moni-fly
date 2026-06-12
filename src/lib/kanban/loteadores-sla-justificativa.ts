import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { KANBAN_NOME_FUNIL_LOTEADORES } from '@/lib/kanban/funil-loteadores';
import { calcularSlaKanbanCard } from '@/lib/kanban/kanban-card-sla';

/** Fases do Funil Loteadores em que a quebra de SLA exige justificativa antes de avançar. */
export const LOTEADORES_FASES_JUSTIFICATIVA_SLA = [
  'viabilidade_moni_inc',
  'dados_loteador_moni_inc',
  'fechar_contrato_moni_inc',
] as const;

export type LoteadoresFaseJustificativaSla = (typeof LOTEADORES_FASES_JUSTIFICATIVA_SLA)[number];

export function faseLoteadoresExigeJustificativaSla(
  slug: string | null | undefined,
): slug is LoteadoresFaseJustificativaSla {
  const s = String(slug ?? '').trim();
  return (LOTEADORES_FASES_JUSTIFICATIVA_SLA as readonly string[]).includes(s);
}

function isLoteadoresKanban(kanbanId?: string | null, kanbanNome?: string | null): boolean {
  if (String(kanbanNome ?? '').trim() === KANBAN_NOME_FUNIL_LOTEADORES) return true;
  return String(kanbanId ?? '').trim() === KANBAN_IDS.LOTEADORES;
}

function faseLoteadoresTemSlaConfigurado(sla_dias?: number | null): boolean {
  return sla_dias != null && sla_dias > 0;
}

/** Banner «Quebra de SLA» no modal — somente com SLA da fase vencido. */
export function deveExibirSecaoQuebraSlaLoteadores(input: {
  kanbanId?: string | null;
  kanbanNome?: string | null;
  faseSlug?: string | null;
  slaStatus: 'ok' | 'atencao' | 'atrasado';
  sla_dias?: number | null;
}): boolean {
  if (!isLoteadoresKanban(input.kanbanId, input.kanbanNome)) return false;
  if (!faseLoteadoresExigeJustificativaSla(input.faseSlug)) return false;
  if (!faseLoteadoresTemSlaConfigurado(input.sla_dias)) return false;
  return input.slaStatus === 'atrasado';
}

export function cardLoteadoresPrecisaJustificativaSla(input: {
  kanbanId?: string | null;
  kanbanNome?: string | null;
  faseSlug?: string | null;
  slaStatus: 'ok' | 'atencao' | 'atrasado';
  slaJustificativa?: string | null;
  sla_dias?: number | null;
}): boolean {
  if (!deveExibirSecaoQuebraSlaLoteadores(input)) return false;
  return !String(input.slaJustificativa ?? '').trim();
}

export function calcularSlaCardLoteadores(input: {
  created_at: string;
  entered_fase_at?: string | null;
  sla_iniciado_em?: string | null;
  faseSlug?: string | null;
  alvara_url?: string | null;
  docs_terreno_url?: string | null;
  sla_dias?: number | null;
}) {
  return calcularSlaKanbanCard(input);
}

export const MSG_GATE_JUSTIFICATIVA_SLA_LOTEADORES =
  'O SLA desta fase está vencido. Registre a justificativa da quebra de SLA antes de mover o card.';
