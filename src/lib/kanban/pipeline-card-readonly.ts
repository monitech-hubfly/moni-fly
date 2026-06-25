import { calcularDiasUteis, formatIsoDateOnlyPtBr, normalizarSlaTipo } from '@/lib/dias-uteis';
import { calcularSlaKanbanCard, type SlaKanbanResult } from '@/lib/kanban/kanban-card-sla';
import type { PipelineCardDisplay, PipelineCardRow } from '@/lib/kanban/pipeline-cards-types';
import type { LinhaCronologiaFase } from '@/lib/kanban/kanban-card-timeline';

/**
 * Painel pipeline: somente leitura.
 * Fase, funil e SLA vêm exclusivamente de `kanban_cards` + joins (`kanban_fases`, `kanbans`).
 * Não há campos paralelos persistidos — status operacional é derivado do SLA/inatividade.
 */
export const PIPELINE_READONLY_NOTA =
  'Visualização consolidada. Alterações de fase e status devem ser feitas no kanban original.';

type CardSlaInput = Pick<
  PipelineCardRow,
  | 'created_at'
  | 'entered_fase_at'
  | 'sla_iniciado_em'
  | 'fase_slug'
  | 'alvara_url'
  | 'docs_terreno_url'
  | 'fase_sla_dias'
  | 'fase_sla_tipo'
>;

/** SLA do card — mesma função usada no board (`KanbanColumn`) e nos filtros do kanban. */
export function slaKanbanCardFromPipelineRow(row: CardSlaInput): SlaKanbanResult {
  return calcularSlaKanbanCard({
    created_at: row.created_at,
    entered_fase_at: row.entered_fase_at,
    sla_iniciado_em: row.sla_iniciado_em,
    faseSlug: row.fase_slug,
    alvara_url: row.alvara_url,
    docs_terreno_url: row.docs_terreno_url,
    sla_dias: row.fase_sla_dias,
    sla_tipo: row.fase_sla_tipo,
  });
}

/** Data de entrada na fase atual — prioriza `kanban_cards.entered_fase_at` (campo oficial do kanban). */
export function dataEntradaFaseAtualKanbanCard(
  card: Pick<PipelineCardRow, 'entered_fase_at' | 'created_at'>,
): string | null {
  return String(card.entered_fase_at ?? card.created_at ?? '').trim() || null;
}

export function formatDataEntradaFaseAtualKanbanCard(
  card: Pick<PipelineCardRow, 'entered_fase_at' | 'created_at'>,
): string | null {
  const iso = dataEntradaFaseAtualKanbanCard(card);
  return iso ? formatIsoDateOnlyPtBr(iso) : null;
}

/** Dias corridos na fase atual — base: `entered_fase_at` do kanban (fallback `created_at`). */
export function calcularDiasNaFase(card: Pick<PipelineCardRow, 'entered_fase_at' | 'created_at'>): number {
  const ref = dataEntradaFaseAtualKanbanCard(card);
  if (!ref) return 0;
  const entrada = new Date(ref);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  entrada.setHours(0, 0, 0, 0);
  if (!Number.isFinite(entrada.getTime())) return 0;
  return Math.max(0, Math.floor((hoje.getTime() - entrada.getTime()) / 86400000));
}

/**
 * Garante que a fase atual da cronologia use os mesmos valores do card no kanban
 * (`entered_fase_at`, fase_nome), evitando divergência com reconstrução parcial do histórico.
 */
export function sincronizarLinhaFaseAtualComCard(
  linhas: LinhaCronologiaFase[],
  card: PipelineCardDisplay,
): LinhaCronologiaFase[] {
  const faseAtualId = String(card.fase_id ?? '').trim();
  if (!faseAtualId) return linhas;

  const entradaOficial = dataEntradaFaseAtualKanbanCard(card);
  if (!entradaOficial) return linhas;

  return linhas.map((l) => {
    if (l.faseId !== faseAtualId) return l;
    return {
      ...l,
      entrouEm: entradaOficial,
      saiuEm: null,
      faseNome: card.fase_nome || l.faseNome,
    };
  });
}

export type PipelineDrawerFaseLinhaBase = {
  faseId: string;
  faseNome: string;
  ordem: number;
  entrouEm: string | null;
  saiuEm: string | null;
  faseAtual: boolean;
};

/** Dias na fase — fase atual usa `entered_fase_at`; fases passadas usam entrada/saída da cronologia. */
export function diasNaFasePipeline(
  linha: PipelineDrawerFaseLinhaBase,
  card: PipelineCardDisplay,
): number | null {
  if (linha.faseAtual) return calcularDiasNaFase(card);
  if (!linha.entrouEm) return null;
  const inicio = new Date(linha.entrouEm);
  const fim = linha.saiuEm ? new Date(linha.saiuEm) : new Date();
  inicio.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);
  if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime())) return null;
  return Math.max(0, Math.floor((fim.getTime() - inicio.getTime()) / 86400000));
}

const TITULO_PIPELINE_MAX = 35;

/** Título do card no pipeline — truncado; fallback FK + sequencial se vazio. */
export function tituloPipelineCardDisplay(
  card: Pick<PipelineCardRow, 'titulo' | 'n_franquia'>,
  sequencial?: number,
): string {
  const raw = String(card.titulo ?? '').trim();
  if (raw && raw !== '(sem título)') {
    return raw.length <= TITULO_PIPELINE_MAX ? raw : `${raw.slice(0, TITULO_PIPELINE_MAX - 1)}…`;
  }
  const fk = String(card.n_franquia ?? '').trim();
  const seq = sequencial != null && sequencial > 0 ? ` #${sequencial}` : '';
  return fk ? `${fk}${seq}` : `Card${seq}`;
}

/** Dias úteis na fase atual — base `entered_fase_at` (fallback `created_at`). */
export function calcularDiasUteisNaFase(card: Pick<PipelineCardRow, 'entered_fase_at' | 'created_at'>): number {
  const ref = dataEntradaFaseAtualKanbanCard(card);
  if (!ref) return 0;
  const entrada = new Date(ref);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  entrada.setHours(0, 0, 0, 0);
  if (!Number.isFinite(entrada.getTime())) return 0;
  return Math.max(0, calcularDiasUteis(entrada, hoje));
}

/** SLA da fase excedido — compara dias na fase com `fase_sla_dias` (úteis ou corridos). */
export function faseSlaExcedido(card: PipelineCardDisplay): boolean {
  if (card.sla.status === 'atrasado') return true;
  const slaDias = card.fase_sla_dias;
  if (slaDias == null || slaDias <= 0) return false;
  const slaTipo = normalizarSlaTipo(card.fase_sla_tipo);
  const diasNaFase =
    slaTipo === 'corridos' ? calcularDiasNaFase(card) : calcularDiasUteisNaFase(card);
  return diasNaFase > slaDias;
}

/** Texto relativo desde entrada na fase: hoje, ontem, há Xd. */
export function formatRelativeNaFaseDesde(card: Pick<PipelineCardRow, 'entered_fase_at' | 'created_at'>): string {
  const dias = calcularDiasNaFase(card);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias}d`;
}

/** Card com SLA vencendo nos próximos 2 dias úteis (não atrasado). */
export function cardVenceEm2DiasUteis(card: PipelineCardDisplay): boolean {
  if (card.sla.pausado || card.sla.status === 'atrasado') return false;
  const rest = card.sla.diasRestantes;
  if (rest == null) return card.sla.label === 'Vence hoje';
  return rest >= 0 && rest <= 2;
}
