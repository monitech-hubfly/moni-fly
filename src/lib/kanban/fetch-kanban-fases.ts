import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanFase } from '@/components/kanban-shared/types';
import { isRemovedStepOneFaseSlug } from '@/lib/kanban/stepone-fase-slugs';
import { parseKanbanFaseMateriais } from './parse-kanban-fase-materiais';

export function mapKanbanFaseRow(row: Record<string, unknown>): KanbanFase {
  return {
    id: String(row.id),
    nome: String(row.nome ?? ''),
    ordem: Number(row.ordem ?? 0),
    sla_dias: row.sla_dias != null && row.sla_dias !== '' ? Number(row.sla_dias) : null,
    slug: row.slug != null ? String(row.slug) : null,
    instrucoes: row.instrucoes != null ? String(row.instrucoes) : null,
    materiais: parseKanbanFaseMateriais(row.materiais),
    fase_conversao: Boolean(row.fase_conversao),
  };
}

/**
 * Fases ativas do kanban para renderização do board e modal.
 * Inclui fases terminais sem SLA (`sla_dias` NULL). Único filtro: `ativo = true`.
 */
export async function fetchKanbanFasesAtivas(
  supabase: SupabaseClient,
  kanbanId: string,
): Promise<KanbanFase[]> {
  const { data: fasesRows, error } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias, slug, instrucoes, materiais, fase_conversao')
    .eq('kanban_id', kanbanId)
    .eq('ativo', true)
    .order('ordem');

  if (error) {
    console.error('[fetchKanbanFasesAtivas]', error.message);
    return [];
  }

  return (fasesRows ?? []).map((row) => mapKanbanFaseRow(row as Record<string, unknown>));
}

/** Inclui fases referenciadas por cards cujo `fase_id` não está nas fases ativas (ex.: fase desativada). */
export async function augmentKanbanFasesComFasesDosCards(
  supabase: SupabaseClient,
  kanbanId: string,
  fases: KanbanFase[],
  cardFaseIds: Iterable<string>,
): Promise<KanbanFase[]> {
  const known = new Set(fases.map((f) => f.id));
  const missing = [...new Set([...cardFaseIds].filter((id) => id && !known.has(id)))];
  if (missing.length === 0) return fases;

  const { data: extraRows, error } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias, slug, instrucoes, materiais, fase_conversao')
    .eq('kanban_id', kanbanId)
    .in('id', missing);

  if (error) {
    console.error('[augmentKanbanFasesComFasesDosCards]', error.message);
    return fases;
  }

  const extra = (extraRows ?? [])
    .map((row) => mapKanbanFaseRow(row as Record<string, unknown>))
    .filter((f) => !isRemovedStepOneFaseSlug(f.slug));
  return [...fases, ...extra].sort((a, b) => a.ordem - b.ordem);
}
