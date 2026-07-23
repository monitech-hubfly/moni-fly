import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanCardBrief, KanbanFase } from '@/components/kanban-shared/types';
import { faseAtualCalculadoraSlaEstourada } from '@/lib/kanban/calculadora-fases';
import { segmentoEsteiraCardCalculadora } from '@/lib/kanban/calculadora-fases-esteira';
import {
  montarCalculadoraPack,
  type CalculadoraPublicaCard,
} from '@/lib/kanban/fetch-calculadora-publica';

type CardCalculadoraCtx = {
  id: string;
  titulo: string;
  kanban_id: string;
  fase_id: string;
  fase_ordem: number;
  created_at: string;
  entered_fase_at: string | null;
  concluido: boolean;
  concluido_em: string | null;
  projeto_id: string | null;
  origem_card_id: string | null;
  processo_step_one_id: string | null;
  contrato_assinado_em: string | null;
  obra_iniciada_em: string | null;
  obra_finalizada_em: string | null;
  opcao_assinada_em: string | null;
};

type CardRowDb = {
  id: string;
  processo_step_one_id?: string | null;
  origem_card_id?: string | null;
  contrato_assinado_em?: string | null;
  obra_iniciada_em?: string | null;
  obra_finalizada_em?: string | null;
  opcao_assinada_em?: string | null;
};

function chaveGrupoCalculadora(card: Pick<CardCalculadoraCtx, 'id' | 'processo_step_one_id' | 'projeto_id' | 'origem_card_id'>): string {
  const proc = String(card.processo_step_one_id ?? '').trim();
  if (proc) return `proc:${proc}`;
  const proj = String(card.projeto_id ?? '').trim();
  if (proj) return `proj:${proj}`;
  const origem = String(card.origem_card_id ?? '').trim();
  if (origem) return `origem:${origem}`;
  return `card:${card.id}`;
}

function escolherRepresentativoGrupo(cards: CardCalculadoraCtx[]): CardCalculadoraCtx {
  return [...cards].sort((a, b) => {
    const segA = segmentoEsteiraCardCalculadora(a.kanban_id);
    const segB = segmentoEsteiraCardCalculadora(b.kanban_id);
    if (segB !== segA) return segB - segA;
    return b.fase_ordem - a.fase_ordem;
  })[0]!;
}

function cardAtivoParaCalculadora(card: KanbanCardBrief): boolean {
  if (card.arquivado) return false;
  if (card.concluido) return false;
  return true;
}

function toYmdOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function cardParaCalculadoraPack(ctx: CardCalculadoraCtx): CalculadoraPublicaCard {
  return {
    id: ctx.id,
    titulo: ctx.titulo,
    kanban_id: ctx.kanban_id,
    fase_id: ctx.fase_id,
    created_at: ctx.created_at,
    entered_fase_at: ctx.entered_fase_at,
    concluido: ctx.concluido,
    concluido_em: ctx.concluido_em,
    contrato_assinado_em: ctx.contrato_assinado_em,
    obra_iniciada_em: ctx.obra_iniciada_em,
    obra_finalizada_em: ctx.obra_finalizada_em,
    opcao_assinada_em: ctx.opcao_assinada_em,
    processo_step_one_id: ctx.processo_step_one_id,
    condominio_id: null,
  };
}

function montarCtxCalculadora(
  card: KanbanCardBrief,
  kanbanId: string,
  faseOrdemPorId: Map<string, number>,
  dbRow: CardRowDb | undefined,
): CardCalculadoraCtx {
  const legado = card.origem === 'legado';
  const procLegado = legado ? String(card.id ?? '').trim() || null : null;
  const procDb = String(dbRow?.processo_step_one_id ?? '').trim() || null;

  return {
    id: String(card.id),
    titulo: String(card.titulo ?? '').trim() || '(sem título)',
    kanban_id: String(card.kanban_id ?? kanbanId),
    fase_id: String(card.fase_id ?? ''),
    fase_ordem: faseOrdemPorId.get(String(card.fase_id ?? '')) ?? 0,
    created_at: String(card.created_at ?? ''),
    entered_fase_at: card.entered_fase_at ?? null,
    concluido: card.concluido ?? false,
    concluido_em: card.concluido_em ?? null,
    projeto_id: card.projeto_id ?? null,
    origem_card_id: dbRow?.origem_card_id != null ? String(dbRow.origem_card_id).trim() || null : null,
    processo_step_one_id: procDb ?? procLegado,
    contrato_assinado_em: toYmdOrNull(dbRow?.contrato_assinado_em),
    obra_iniciada_em: toYmdOrNull(dbRow?.obra_iniciada_em),
    obra_finalizada_em: toYmdOrNull(dbRow?.obra_finalizada_em),
    opcao_assinada_em: toYmdOrNull(dbRow?.opcao_assinada_em),
  };
}

async function fetchCamposCalculadoraPorCardIds(
  supabase: SupabaseClient,
  cardIds: string[],
): Promise<Map<string, CardRowDb>> {
  const out = new Map<string, CardRowDb>();
  if (cardIds.length === 0) return out;

  const { data } = await supabase
    .from('kanban_cards')
    .select(
      'id, processo_step_one_id, origem_card_id, contrato_assinado_em, obra_iniciada_em, obra_finalizada_em, opcao_assinada_em',
    )
    .in('id', cardIds);

  for (const row of data ?? []) {
    const id = String((row as { id?: string }).id ?? '').trim();
    if (!id) continue;
    out.set(id, row as CardRowDb);
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

function agruparCardsCalculadora(
  cards: KanbanCardBrief[],
  kanbanId: string,
  faseOrdemPorId: Map<string, number>,
  dbPorId: Map<string, CardRowDb>,
): Map<string, { rep: CardCalculadoraCtx; membros: CardCalculadoraCtx[] }> {
  const porChave = new Map<string, CardCalculadoraCtx[]>();

  for (const card of cards) {
    if (!cardAtivoParaCalculadora(card)) continue;
    const ctx = montarCtxCalculadora(card, kanbanId, faseOrdemPorId, dbPorId.get(card.id));
    const chave = chaveGrupoCalculadora(ctx);
    const list = porChave.get(chave) ?? [];
    list.push(ctx);
    porChave.set(chave, list);
  }

  const out = new Map<string, { rep: CardCalculadoraCtx; membros: CardCalculadoraCtx[] }>();
  for (const [chave, membros] of porChave) {
    out.set(chave, { rep: escolherRepresentativoGrupo(membros), membros });
  }
  return out;
}

/**
 * Enriquece cards ativos do board com `calculadora_sla_estourado` (Calculadora, não SLA de fase).
 * Agrupa por sync de negócio e calcula uma vez por grupo (concorrência limitada).
 */
export async function enrichCardsComCalculadoraSlaEstourado(
  supabase: SupabaseClient,
  cards: KanbanCardBrief[],
  kanbanId: string,
  fases: KanbanFase[],
): Promise<KanbanCardBrief[]> {
  const ativos = cards.filter(cardAtivoParaCalculadora);
  if (ativos.length === 0) return cards;

  const faseOrdemPorId = new Map(fases.map((f) => [f.id, f.ordem]));
  const nativoIds = ativos.filter((c) => c.origem !== 'legado').map((c) => c.id);
  const dbPorId = await fetchCamposCalculadoraPorCardIds(supabase, nativoIds);
  const grupos = agruparCardsCalculadora(ativos, kanbanId, faseOrdemPorId, dbPorId);

  if (grupos.size === 0) return cards;

  const entries = [...grupos.entries()];
  const resultados = await mapWithConcurrency(entries, 4, async ([, { rep, membros }]) => {
    try {
      const pack = await montarCalculadoraPack(supabase, cardParaCalculadoraPack(rep));
      const estourado = pack ? faseAtualCalculadoraSlaEstourada(pack.linhas) : false;
      return { ids: membros.map((m) => m.id), estourado };
    } catch {
      return { ids: membros.map((m) => m.id), estourado: false };
    }
  });

  const estouradoPorId = new Map<string, boolean>();
  for (const { ids, estourado } of resultados) {
    for (const id of ids) estouradoPorId.set(id, estourado);
  }

  return cards.map((card) => {
    if (!estouradoPorId.has(card.id)) return card;
    return { ...card, calculadora_sla_estourado: estouradoPorId.get(card.id) === true };
  });
}
