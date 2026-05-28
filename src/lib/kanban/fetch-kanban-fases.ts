import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanFase } from '@/components/kanban-shared/types';
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
    .select('id, nome, ordem, sla_dias, slug, instrucoes, materiais')
    .eq('kanban_id', kanbanId)
    .eq('ativo', true)
    .order('ordem');

  if (error) {
    console.error('[fetchKanbanFasesAtivas]', error.message);
    return [];
  }

  return (fasesRows ?? []).map((row) => mapKanbanFaseRow(row as Record<string, unknown>));
}
