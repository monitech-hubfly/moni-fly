'use server';

import { createClient } from '@/lib/supabase/server';
import {
  fetchKanbanBoardSnapshot,
  type KanbanBoardSnapshotMode,
} from '@/components/kanban-shared/fetchKanbanBoardSnapshot';
import type { KanbanCardBrief } from '@/components/kanban-shared/types';

export type FetchKanbanBoardStatusPoolResult =
  | {
      ok: true;
      status: 'arquivados' | 'concluidos';
      cards: KanbanCardBrief[];
      cardsConcluidos: KanbanCardBrief[];
    }
  | { ok: false; error: string };

/**
 * Carrega sob demanda o pool do filtro STATUS (arquivados ou concluídos).
 * Usado pelo KanbanBoard após o snapshot lean inicial (só ativos).
 */
export async function fetchKanbanBoardStatusPool(
  kanbanNomeDb: string,
  status: 'arquivados' | 'concluidos',
): Promise<FetchKanbanBoardStatusPoolResult> {
  const nome = String(kanbanNomeDb ?? '').trim();
  if (!nome) return { ok: false, error: 'Kanban não informado.' };
  if (status !== 'arquivados' && status !== 'concluidos') {
    return { ok: false, error: 'Status inválido.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const mode: KanbanBoardSnapshotMode = status;
  try {
    const snap = await fetchKanbanBoardSnapshot(supabase, nome, user.id, { mode });
    if (!snap.kanban) return { ok: false, error: 'Kanban não encontrado.' };
    return {
      ok: true,
      status,
      cards: snap.cards,
      cardsConcluidos: snap.cardsConcluidos,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao carregar cards.';
    return { ok: false, error: msg };
  }
}
