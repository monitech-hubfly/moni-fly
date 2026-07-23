import type { SupabaseClient } from '@supabase/supabase-js';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { PipelineCardRow } from '@/lib/kanban/pipeline-cards-types';
import {
  montarCalculadoraPack,
  type CalculadoraPublicaCard,
} from '@/lib/kanban/fetch-calculadora-publica';
import { segmentoEsteiraCardCalculadora } from '@/lib/kanban/calculadora-fases-esteira';
import type { CalculadoraFaseLinha } from '@/lib/kanban/calculadora-fases';

export type PipelineEsteiraCalculadoraPack = {
  /** Card usado como âncora do cálculo (sync group). */
  cardId: string;
  linhas: CalculadoraFaseLinha[];
};

export type PipelineEsteiraCalculadoraPorGrupo = Record<string, PipelineEsteiraCalculadoraPack>;

const ESTEIRA_KANBAN_IDS = new Set<string>([KANBAN_IDS.PORTFOLIO, KANBAN_IDS.OPERACOES]);

/** Chave de agrupamento — cards vinculados compartilham processo/projeto. */
export function chaveGrupoEsteiraCalculadora(card: PipelineCardRow): string {
  const proc = String(card.processo_step_one_id ?? '').trim();
  if (proc) return `proc:${proc}`;
  const proj = String(card.projeto_id ?? '').trim();
  if (proj) return `proj:${proj}`;
  const origem = String(card.origem_card_id ?? '').trim();
  if (origem) return `origem:${origem}`;
  return `card:${card.id}`;
}

function cardParaCalculadora(card: PipelineCardRow): CalculadoraPublicaCard {
  return {
    id: card.id,
    titulo: card.titulo,
    kanban_id: card.kanban_id,
    fase_id: card.fase_id,
    created_at: card.created_at,
    entered_fase_at: card.entered_fase_at,
    concluido: card.concluido,
    concluido_em: null,
    contrato_assinado_em: card.contrato_assinado_em ?? null,
    obra_iniciada_em: card.obra_iniciada_em ?? null,
    obra_finalizada_em: card.obra_finalizada_em ?? null,
    opcao_assinada_em: card.opcao_assinada_em ?? null,
    processo_step_one_id: card.processo_step_one_id ?? null,
    condominio_id: null,
  };
}

/** Escolhe card representativo do grupo (Operações > Portfólio; fase mais avançada). */
export function escolherCardRepresentativoGrupo(cards: PipelineCardRow[]): PipelineCardRow {
  return [...cards].sort((a, b) => {
    const segA = segmentoEsteiraCardCalculadora(a.kanban_id);
    const segB = segmentoEsteiraCardCalculadora(b.kanban_id);
    if (segB !== segA) return segB - segA;
    return (b.fase_ordem ?? 0) - (a.fase_ordem ?? 0);
  })[0]!;
}

/** Agrupa cards elegíveis (Portfólio + Pré Obra e Obra) por sync de negócio. */
export function agruparCardsEsteiraCalculadora(
  cards: PipelineCardRow[],
): Map<string, { rep: PipelineCardRow; membros: PipelineCardRow[] }> {
  const porChave = new Map<string, PipelineCardRow[]>();

  for (const card of cards) {
    if (!ESTEIRA_KANBAN_IDS.has(card.kanban_id)) continue;
    const chave = chaveGrupoEsteiraCalculadora(card);
    const list = porChave.get(chave) ?? [];
    list.push(card);
    porChave.set(chave, list);
  }

  const out = new Map<string, { rep: PipelineCardRow; membros: PipelineCardRow[] }>();
  for (const [chave, membros] of porChave) {
    out.set(chave, { rep: escolherCardRepresentativoGrupo(membros), membros });
  }
  return out;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]!);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Calcula linhas da calculadora para cada grupo de negócio (Portfólio + Operações vinculados).
 * Retorna mapa chaveGrupo → pack (linhas idênticas em todos os cards do sync group).
 */
export async function fetchPipelineEsteiraCalculadora(
  supabase: SupabaseClient,
  cards: PipelineCardRow[],
): Promise<PipelineEsteiraCalculadoraPorGrupo> {
  const grupos = agruparCardsEsteiraCalculadora(cards);
  if (grupos.size === 0) return {};

  const entries = [...grupos.entries()];
  const packs = await mapWithConcurrency(entries, 4, async ([chave, { rep }]) => {
    const pack = await montarCalculadoraPack(supabase, cardParaCalculadora(rep));
    return { chave, pack: pack ? { cardId: rep.id, linhas: pack.linhas } : null };
  });

  const result: PipelineEsteiraCalculadoraPorGrupo = {};
  for (const { chave, pack } of packs) {
    if (pack && pack.linhas.length > 0) result[chave] = pack;
  }
  return result;
}

/** Resolve pack da calculadora para um card (via chave de grupo). */
export function resolverPackEsteiraCalculadora(
  card: PipelineCardRow,
  porGrupo: PipelineEsteiraCalculadoraPorGrupo,
): PipelineEsteiraCalculadoraPack | null {
  return porGrupo[chaveGrupoEsteiraCalculadora(card)] ?? null;
}
