'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  allocNextOrdemColunaKanban,
  reorderAppend,
  reorderInsertBefore,
} from '@/lib/kanban/kanban-coluna-ordem';
import { allocNextOrdemColunaPainel } from '@/lib/painel-coluna-ordem';
import { moverCardParaFase, type ActionResult } from './card-actions';

export type KanbanDnDCardOrigem = 'nativo' | 'legado';

async function persistOrdemNativo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  faseId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const results = await Promise.all(
    orderedIds.map((id, idx) =>
      supabase.from('kanban_cards').update({ ordem_coluna: idx }).eq('id', id),
    ),
  );
  const failed = results.find((x) => x.error);
  if (failed?.error) return { ok: false, error: failed.error.message };
  return { ok: true };
}

async function persistOrdemLegado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  etapaPainel: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const now = new Date().toISOString();
  const results = await Promise.all(
    orderedIds.map((id, idx) =>
      supabase
        .from('processo_step_one')
        .update({ ordem_coluna_painel: idx, updated_at: now })
        .eq('id', id),
    ),
  );
  const failed = results.find((x) => x.error);
  if (failed?.error) return { ok: false, error: failed.error.message };
  return { ok: true };
}

async function registrarMovimentoLegado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  cardId: string,
  fromSlug: string,
  toSlug: string,
): Promise<void> {
  const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
  const nome = String((prof as { full_name?: string | null } | null)?.full_name ?? '').trim();
  await supabase.from('processo_card_eventos').insert({
    processo_id: cardId,
    autor_id: userId,
    autor_nome: nome.length > 0 ? nome : null,
    etapa_painel: toSlug,
    tipo: 'card_move',
    descricao: 'Movimentação no funil (legado)',
    detalhes: { from: fromSlug, to: toSlug },
  });
}

export async function moverCardKanbanDrag(input: {
  cardId: string;
  toFaseId: string;
  toFaseSlug?: string | null;
  fromFaseSlug?: string | null;
  origem: KanbanDnDCardOrigem;
  basePath: string;
  kanbanNome?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para mover o card.' };

  const cardId = String(input.cardId ?? '').trim();
  const toFaseId = String(input.toFaseId ?? '').trim();
  const toFaseSlug = String(input.toFaseSlug ?? '').trim();
  if (!cardId || !toFaseId) return { ok: false, error: 'Dados inválidos.' };

  if (input.origem === 'legado') {
    if (!toFaseSlug) return { ok: false, error: 'Fase de destino sem slug.' };
    const fromSlug = String(input.fromFaseSlug ?? '').trim();
    const ordem = await allocNextOrdemColunaPainel(supabase, toFaseSlug);
    const { error } = await supabase
      .from('processo_step_one')
      .update({ etapa_painel: toFaseSlug, ordem_coluna_painel: ordem })
      .eq('id', cardId);
    if (error) return { ok: false, error: error.message };
    if (fromSlug && fromSlug !== toFaseSlug) {
      await registrarMovimentoLegado(supabase, user.id, cardId, fromSlug, toFaseSlug);
    }
  } else {
    const res = await moverCardParaFase({
      cardId,
      novaFaseId: toFaseId,
      basePath: input.basePath,
      kanbanNome: input.kanbanNome,
    });
    if (!res.ok) return res;
    const ordem = await allocNextOrdemColunaKanban(supabase, toFaseId);
    const { error: ordErr } = await supabase
      .from('kanban_cards')
      .update({ ordem_coluna: ordem })
      .eq('id', cardId);
    if (ordErr) return { ok: false, error: ordErr.message };
  }

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}

export async function reordenarCardKanbanDrag(input: {
  cardId: string;
  faseId: string;
  faseSlug?: string | null;
  beforeCardId: string | null;
  origem: KanbanDnDCardOrigem;
  basePath: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para reordenar o card.' };

  const cardId = String(input.cardId ?? '').trim();
  const faseId = String(input.faseId ?? '').trim();
  if (!cardId || !faseId) return { ok: false, error: 'Dados inválidos.' };

  if (input.origem === 'legado') {
    const etapaPainel = String(input.faseSlug ?? '').trim();
    if (!etapaPainel) return { ok: false, error: 'Fase sem slug para reordenar card legado.' };

    const { data: row } = await supabase
      .from('processo_step_one')
      .select('etapa_painel, arquivado, concluido, status, cancelado_em, removido_em')
      .eq('id', cardId)
      .maybeSingle();
    if (!row) return { ok: false, error: 'Card não encontrado.' };
    const r = row as {
      etapa_painel?: string | null;
      status?: string | null;
      cancelado_em?: string | null;
      removido_em?: string | null;
    };
    if (r.etapa_painel !== etapaPainel) return { ok: false, error: 'Card não está nesta fase.' };

    const { data: allRows } = await supabase
      .from('processo_step_one')
      .select('id')
      .eq('etapa_painel', etapaPainel)
      .order('ordem_coluna_painel', { ascending: true })
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true });

    const globalOrder = (allRows ?? []).map((x) => String((x as { id: string }).id));
    if (!globalOrder.includes(cardId)) {
      return { ok: false, error: 'Ordem da coluna desatualizada. Atualize a página.' };
    }

    const beforeId = input.beforeCardId ? String(input.beforeCardId).trim() : null;
    let nextOrder: string[];
    if (!beforeId) {
      nextOrder = reorderAppend(globalOrder, cardId);
    } else {
      if (!globalOrder.includes(beforeId)) {
        return { ok: false, error: 'Posição de destino inválida.' };
      }
      nextOrder = reorderInsertBefore(globalOrder, cardId, beforeId);
    }

    if (nextOrder.join(',') === globalOrder.join(',')) {
      return { ok: false, error: 'Não foi possível alterar a ordem.' };
    }

    const res = await persistOrdemLegado(supabase, etapaPainel, nextOrder);
    if (!res.ok) return res;
  } else {
    const { data: row } = await supabase
      .from('kanban_cards')
      .select('fase_id, arquivado, concluido')
      .eq('id', cardId)
      .maybeSingle();
    if (!row) return { ok: false, error: 'Card não encontrado.' };
    const r = row as { fase_id?: string | null; arquivado?: boolean | null; concluido?: boolean | null };
    if (String(r.fase_id ?? '') !== faseId) return { ok: false, error: 'Card não está nesta fase.' };
    if (r.arquivado || r.concluido) return { ok: false, error: 'Card arquivado ou concluído não pode ser reordenado.' };

    const { data: allRows } = await supabase
      .from('kanban_cards')
      .select('id')
      .eq('fase_id', faseId)
      .eq('arquivado', false)
      .eq('concluido', false)
      .order('ordem_coluna', { ascending: true })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });

    const globalOrder = (allRows ?? []).map((x) => String((x as { id: string }).id));
    if (!globalOrder.includes(cardId)) {
      return { ok: false, error: 'Ordem da coluna desatualizada. Atualize a página.' };
    }

    const beforeId = input.beforeCardId ? String(input.beforeCardId).trim() : null;
    let nextOrder: string[];
    if (!beforeId) {
      nextOrder = reorderAppend(globalOrder, cardId);
    } else {
      if (!globalOrder.includes(beforeId)) {
        return { ok: false, error: 'Posição de destino inválida.' };
      }
      nextOrder = reorderInsertBefore(globalOrder, cardId, beforeId);
    }

    if (nextOrder.join(',') === globalOrder.join(',')) {
      return { ok: false, error: 'Não foi possível alterar a ordem.' };
    }

    const res = await persistOrdemNativo(supabase, faseId, nextOrder);
    if (!res.ok) return res;
  }

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}
