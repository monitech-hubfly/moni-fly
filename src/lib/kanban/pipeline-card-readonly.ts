import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
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
