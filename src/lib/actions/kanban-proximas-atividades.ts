'use server';

import { createClient } from '@/lib/supabase/server';
import type { KanbanProximaAtividadeAberta } from '@/components/kanban-shared/types';

export type FetchKanbanProximasAtividadesBatchResult =
  | { ok: true; byCardId: Record<string, KanbanProximaAtividadeAberta[]> }
  | { ok: false; error: string };

/** Atividades abertas por card — uma query em lote para o popover do board. */
export async function fetchKanbanProximasAtividadesPorCardIds(
  cardIds: string[],
): Promise<FetchKanbanProximasAtividadesBatchResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const ids = [...new Set(cardIds.map((id) => String(id ?? '').trim()).filter(Boolean))];
  if (ids.length === 0) return { ok: true, byCardId: {} };

  const byCardId: Record<string, KanbanProximaAtividadeAberta[]> = {};
  const chunkSize = 300;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize);
    const { data: rows, error } = await (supabase as any)
      .from('kanban_proximas_atividades')
      .select('id, card_id, descricao, prazo')
      .in('card_id', slice)
      .is('concluido_em', null)
      .order('prazo', { ascending: true, nullsFirst: false });

    if (error) return { ok: false, error: error.message };

    for (const row of rows ?? []) {
      const cardId = String((row as { card_id?: string }).card_id ?? '').trim();
      if (!cardId) continue;
      const lista = byCardId[cardId] ?? [];
      lista.push({
        id: String((row as { id?: string }).id ?? ''),
        descricao: String((row as { descricao?: string }).descricao ?? ''),
        prazo: ((row as { prazo?: string | null }).prazo as string | null) ?? null,
      });
      byCardId[cardId] = lista;
    }
  }

  return { ok: true, byCardId };
}
