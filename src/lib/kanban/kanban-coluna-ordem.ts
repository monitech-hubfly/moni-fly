import type { SupabaseClient } from '@supabase/supabase-js';

export type KanbanCardOrdemColuna = {
  id: string;
  ordem_coluna?: number | null;
  created_at?: string | null;
};

export function sortKanbanCardsPorOrdemColuna<T extends KanbanCardOrdemColuna>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const oa = a.ordem_coluna ?? 0;
    const ob = b.ordem_coluna ?? 0;
    if (oa !== ob) return oa - ob;
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function reorderInsertBefore(global: string[], moving: string, beforeId: string): string[] {
  if (moving === beforeId) return global;
  const g = global.filter((id) => id !== moving);
  const i = g.indexOf(beforeId);
  if (i < 0) return global;
  return [...g.slice(0, i), moving, ...g.slice(i)];
}

export function reorderAppend(global: string[], moving: string): string[] {
  const g = global.filter((id) => id !== moving);
  return [...g, moving];
}

/** Próximo índice no fim da fase (card novo ou vindo de outra coluna). */
export async function allocNextOrdemColunaKanban(
  supabase: SupabaseClient,
  faseId: string,
): Promise<number> {
  const { data } = await supabase
    .from('kanban_cards')
    .select('ordem_coluna')
    .eq('fase_id', faseId)
    .order('ordem_coluna', { ascending: false })
    .limit(1)
    .maybeSingle();

  const max = (data as { ordem_coluna?: number } | null)?.ordem_coluna;
  return (typeof max === 'number' ? max : -1) + 1;
}
