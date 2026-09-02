'use server';

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

async function reordenarNaFase(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  cardId: string;
  faseId: string;
  faseSlug?: string | null;
  beforeCardId: string | null;
  origem: KanbanDnDCardOrigem;
}): Promise<ActionResult> {
  const { supabase, cardId, faseId, origem } = input;

  if (origem === 'legado') {
    const etapaPainel = String(input.faseSlug ?? '').trim();
    if (!etapaPainel) return { ok: false, error: 'Fase sem slug para reordenar card legado.' };

    const { data: row } = await supabase
      .from('processo_step_one')
      .select('etapa_painel')
      .eq('id', cardId)
      .maybeSingle();
    if (!row) return { ok: false, error: 'Card não encontrado.' };
    if ((row as { etapa_painel?: string | null }).etapa_painel !== etapaPainel) {
      return { ok: false, error: 'Card não está nesta fase.' };
    }

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

    if (nextOrder.join(',') === globalOrder.join(',')) return { ok: true };
    return persistOrdemLegado(supabase, etapaPainel, nextOrder);
  }

  const { data: row } = await supabase
    .from('kanban_cards')
    .select('fase_id, arquivado, concluido')
    .eq('id', cardId)
    .maybeSingle();
  if (!row) return { ok: false, error: 'Card não encontrado.' };
  const r = row as { fase_id?: string | null; arquivado?: boolean | null; concluido?: boolean | null };
  if (String(r.fase_id ?? '') !== faseId) return { ok: false, error: 'Card não está nesta fase.' };

  let ordemQuery = supabase.from('kanban_cards').select('id').eq('fase_id', faseId);
  if (Boolean(r.arquivado)) {
    ordemQuery = ordemQuery.eq('arquivado', true);
  } else if (Boolean(r.concluido)) {
    ordemQuery = ordemQuery.eq('concluido', true).eq('arquivado', false);
  } else {
    ordemQuery = ordemQuery.eq('arquivado', false).eq('concluido', false);
  }

  const { data: allRows } = await ordemQuery
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

  if (nextOrder.join(',') === globalOrder.join(',')) return { ok: true };
  return persistOrdemNativo(supabase, faseId, nextOrder);
}

/**
 * DnD do board: move + reordena em uma única chamada.
 * Sem revalidatePath no caminho crítico — o client atualiza otimisticamente.
 */
export async function aplicarDnDKanbanCard(input: {
  cardId: string;
  toFaseId: string;
  toFaseSlug?: string | null;
  fromFaseId: string;
  fromFaseSlug?: string | null;
  beforeCardId?: string | null;
  origem: KanbanDnDCardOrigem;
  basePath: string;
  kanbanNome?: string;
  motivoReprovacaoAcoplamento?: string;
  justificativaSlaQuebra?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para mover o card.' };

  const cardId = String(input.cardId ?? '').trim();
  const toFaseId = String(input.toFaseId ?? '').trim();
  const fromFaseId = String(input.fromFaseId ?? '').trim();
  const toFaseSlug = String(input.toFaseSlug ?? '').trim();
  if (!cardId || !toFaseId) return { ok: false, error: 'Dados inválidos.' };

  const mesmaFase = fromFaseId === toFaseId;
  const beforeRaw = input.beforeCardId;
  const beforeCardId =
    beforeRaw === undefined || beforeRaw === null
      ? null
      : String(beforeRaw).trim() || null;

  if (!mesmaFase) {
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
        motivoReprovacaoAcoplamento: input.motivoReprovacaoAcoplamento,
        justificativaSlaQuebra: input.justificativaSlaQuebra,
        skipRevalidate: true,
      });
      if (!res.ok) return res;
      const ordem = await allocNextOrdemColunaKanban(supabase, toFaseId);
      const { error: ordErr } = await supabase
        .from('kanban_cards')
        .update({ ordem_coluna: ordem })
        .eq('id', cardId);
      if (ordErr) return { ok: false, error: ordErr.message };
    }
  }

  const precisaReordenar =
    mesmaFase || (beforeCardId != null && beforeCardId !== cardId);
  if (precisaReordenar && beforeCardId !== cardId) {
    const resOrd = await reordenarNaFase({
      supabase,
      cardId,
      faseId: toFaseId,
      faseSlug: toFaseSlug || input.fromFaseSlug || null,
      beforeCardId,
      origem: input.origem,
    });
    if (!resOrd.ok) return resOrd;
  }

  return { ok: true };
}

/** @deprecated Preferir `aplicarDnDKanbanCard` (uma chamada, sem revalidate). */
export async function moverCardKanbanDrag(input: {
  cardId: string;
  toFaseId: string;
  toFaseSlug?: string | null;
  fromFaseSlug?: string | null;
  origem: KanbanDnDCardOrigem;
  basePath: string;
  kanbanNome?: string;
  motivoReprovacaoAcoplamento?: string;
  justificativaSlaQuebra?: string;
}): Promise<ActionResult> {
  return aplicarDnDKanbanCard({
    cardId: input.cardId,
    toFaseId: input.toFaseId,
    toFaseSlug: input.toFaseSlug,
    fromFaseId: '',
    fromFaseSlug: input.fromFaseSlug,
    beforeCardId: undefined,
    origem: input.origem,
    basePath: input.basePath,
    kanbanNome: input.kanbanNome,
    motivoReprovacaoAcoplamento: input.motivoReprovacaoAcoplamento,
    justificativaSlaQuebra: input.justificativaSlaQuebra,
  });
}

/** @deprecated Preferir `aplicarDnDKanbanCard`. */
export async function reordenarCardKanbanDrag(input: {
  cardId: string;
  faseId: string;
  faseSlug?: string | null;
  beforeCardId: string | null;
  origem: KanbanDnDCardOrigem;
  basePath: string;
}): Promise<ActionResult> {
  return aplicarDnDKanbanCard({
    cardId: input.cardId,
    toFaseId: input.faseId,
    toFaseSlug: input.faseSlug,
    fromFaseId: input.faseId,
    fromFaseSlug: input.faseSlug,
    beforeCardId: input.beforeCardId,
    origem: input.origem,
    basePath: input.basePath,
  });
}
