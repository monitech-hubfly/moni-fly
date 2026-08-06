'use server';

import { createClient } from '@/lib/supabase/server';
import {
  fetchKanbanBoardEnrichmentPatches,
} from '@/components/kanban-shared/fetchKanbanBoardSnapshot';
import type { KanbanCardBrief } from '@/components/kanban-shared/types';

export type FetchKanbanBoardDeferredEnrichmentResult =
  | { ok: true; patches: Record<string, Partial<KanbanCardBrief>> }
  | { ok: false; error: string };

/**
 * Enriquecimentos pesados do board após paint inicial.
 * Portfólio/Operações: títulos, tags, fase reconciliada, paralelas, responsável e SLA.
 * Demais funis: paralelas, responsável e calculadora SLA.
 */
export async function fetchKanbanBoardDeferredEnrichment(
  kanbanNomeDb: string,
  kanbanId: string,
): Promise<FetchKanbanBoardDeferredEnrichmentResult> {
  const nome = String(kanbanNomeDb ?? '').trim();
  const kid = String(kanbanId ?? '').trim();
  if (!nome || !kid) return { ok: false, error: 'Kanban não informado.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  try {
    const patches = await fetchKanbanBoardEnrichmentPatches(supabase, nome, kid, user.id);
    return { ok: true, patches };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao enriquecer cards.';
    return { ok: false, error: msg };
  }
}
