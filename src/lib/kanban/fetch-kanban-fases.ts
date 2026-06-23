import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanFase } from '@/components/kanban-shared/types';
import { normalizarSlaTipo } from '@/lib/dias-uteis';
import { isRemovedStepOneFaseSlug } from '@/lib/kanban/stepone-fase-slugs';
import { parseKanbanFaseMateriais } from './parse-kanban-fase-materiais';
import type { FaseNegocioPrazoOpcao } from './dados-negocio-prazo';

export function mapKanbanFaseRow(row: Record<string, unknown>): KanbanFase {
  return {
    id: String(row.id),
    nome: String(row.nome ?? ''),
    ordem: Number(row.ordem ?? 0),
    sla_dias: row.sla_dias != null && row.sla_dias !== '' ? Number(row.sla_dias) : null,
    sla_tipo: normalizarSlaTipo(row.sla_tipo != null ? String(row.sla_tipo) : null),
    slug: row.slug != null ? String(row.slug) : null,
    instrucoes: row.instrucoes != null ? String(row.instrucoes) : null,
    materiais: parseKanbanFaseMateriais(row.materiais),
    fase_conversao: Boolean(row.fase_conversao),
    ativo: row.ativo !== false && row.ativo !== 'false',
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
    .select('id, nome, ordem, sla_dias, sla_tipo, slug, instrucoes, materiais, fase_conversao, ativo')
    .eq('kanban_id', kanbanId)
    .eq('ativo', true)
    .order('ordem');

  if (error) {
    console.error('[fetchKanbanFasesAtivas]', error.message);
    return [];
  }

  return (fasesRows ?? []).map((row) => mapKanbanFaseRow(row as Record<string, unknown>));
}

/** Fases ativas de vários kanbans em uma única query (pipeline / painel). */
export async function fetchKanbanFasesAtivasBatch(
  supabase: SupabaseClient,
  kanbanIds: string[],
): Promise<KanbanFase[]> {
  const uniq = [...new Set(kanbanIds.map((id) => String(id ?? '').trim()).filter(Boolean))];
  if (uniq.length === 0) return [];

  const { data: fasesRows, error } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias, sla_tipo, slug, instrucoes, materiais, fase_conversao, kanban_id')
    .in('kanban_id', uniq)
    .eq('ativo', true)
    .order('ordem');

  if (error) {
    console.error('[fetchKanbanFasesAtivasBatch]', error.message);
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
    .select('id, nome, ordem, sla_dias, sla_tipo, slug, instrucoes, materiais, fase_conversao, ativo')
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

/** Todas as fases ativas de todos os kanbans — seletor de âncora em Dados do Negócio. */
export async function fetchFasesNegocioPrazoOpcoes(supabase: SupabaseClient): Promise<FaseNegocioPrazoOpcao[]> {
  const { data, error } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, kanban_id, kanbans(nome)')
    .eq('ativo', true)
    .order('ordem');

  if (error) {
    console.error('[fetchFasesNegocioPrazoOpcoes]', error.message);
    return [];
  }

  type Row = {
    id: string;
    nome?: string | null;
    ordem?: number | null;
    kanban_id?: string | null;
    kanbans?: { nome?: string | null } | { nome?: string | null }[] | null;
  };

  const rows = (data ?? []) as Row[];
  return rows
    .map((row) => {
      const kanbanJoin = row.kanbans;
      const kanbanNome = Array.isArray(kanbanJoin)
        ? String(kanbanJoin[0]?.nome ?? '').trim()
        : String(kanbanJoin?.nome ?? '').trim();
      const faseNome = String(row.nome ?? '').trim();
      const label = kanbanNome ? `${kanbanNome} — ${faseNome}` : faseNome;
      return {
        id: String(row.id),
        label,
        kanbanNome,
        ordem: Number(row.ordem ?? 0),
      };
    })
    .sort((a, b) => {
      const kanbanCmp = a.kanbanNome.localeCompare(b.kanbanNome, 'pt-BR');
      if (kanbanCmp !== 0) return kanbanCmp;
      return a.ordem - b.ordem;
    })
    .map(({ id, label }) => ({ id, label }));
}
