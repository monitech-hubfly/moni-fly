'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { KanbanProximaAtividadeAberta } from '@/components/kanban-shared/types';

type ProximaAtividadeItemResult = { id: string; descricao: string; prazo: string | null };

type ActionResult =
  | {
      ok: true;
      item?: ProximaAtividadeItemResult;
      proxima_atividade?: string | null;
      prazo_atividade?: string | null;
    }
  | { ok: false; error: string };

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

/** Lista atividades abertas de um único card. */
export async function buscarAtividadesAbertasCard(
  cardId: string,
): Promise<KanbanProximaAtividadeAberta[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const id = String(cardId ?? '').trim();
  if (!id) return [];

  const { data: rows } = await (supabase as any)
    .from('kanban_proximas_atividades')
    .select('id, card_id, descricao, prazo')
    .eq('card_id', id)
    .is('concluido_em', null)
    .order('prazo', { ascending: true, nullsFirst: false });

  return (rows ?? []).map((row: { id?: string; descricao?: string; prazo?: string | null }) => ({
    id: String(row.id ?? ''),
    descricao: String(row.descricao ?? ''),
    prazo: (row.prazo as string | null) ?? null,
  }));
}

export type AdicionarProximaAtividadeItemInput = {
  cardId: string;
  descricao: string;
  prazo?: string | null;
  basePath?: string;
  skipRevalidate?: boolean;
};

/** Sincroniza kanban_cards.proxima_atividade com a atividade mais urgente em aberto. */
async function sincronizarProximaAtividadeCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
): Promise<{ proxima_atividade: string | null; prazo_atividade: string | null }> {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: abertas } = await (supabase as any)
    .from('kanban_proximas_atividades')
    .select('descricao, prazo')
    .eq('card_id', cardId)
    .is('concluido_em', null)
    .order('prazo', { ascending: true, nullsFirst: false });

  const lista = (abertas ?? []) as { descricao: string; prazo: string | null }[];
  const atrasadas = lista.filter((a) => a.prazo && a.prazo < hoje);
  const hojeItems = lista.filter((a) => a.prazo === hoje);
  const futuras = lista.filter((a) => !a.prazo || a.prazo > hoje);
  const ordenada = [...atrasadas, ...hojeItems, ...futuras];
  const proxima = ordenada[0] ?? null;

  const sync = {
    proxima_atividade: proxima?.descricao ?? null,
    prazo_atividade: proxima?.prazo ?? null,
  };

  await (supabase as any)
    .from('kanban_cards')
    .update({ ...sync, updated_at: new Date().toISOString() })
    .eq('id', cardId);

  return sync;
}

/** Adiciona uma nova atividade aberta ao card em `kanban_proximas_atividades`. */
export async function adicionarProximaAtividadeItem(
  input: AdicionarProximaAtividadeItemInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const descricao = String(input.descricao ?? '').trim();
  if (!descricao) return { ok: false, error: 'Descrição obrigatória.' };

  const prazo = input.prazo ?? null;

  const { data: inserted, error } = await (supabase as any)
    .from('kanban_proximas_atividades')
    .insert({ card_id: cardId, descricao, prazo, criado_por: user.id })
    .select('id, descricao, prazo')
    .single();

  if (error) return { ok: false, error: error.message };

  const sync = await sincronizarProximaAtividadeCard(supabase, cardId);

  if (!input.skipRevalidate) {
    const base = String(input.basePath ?? '/').trim() || '/';
    revalidatePath(base);
    revalidatePath('/');
  }

  const item: ProximaAtividadeItemResult = inserted ?? { id: '', descricao, prazo };
  return { ok: true, item, ...sync };
}

export type ConcluirProximaAtividadeItemInput = {
  itemId: string;
  cardId: string;
  basePath?: string;
  skipRevalidate?: boolean;
};

/** Marca uma atividade como concluída via `concluido_em`. */
export async function concluirProximaAtividadeItem(
  input: ConcluirProximaAtividadeItemInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const itemId = String(input.itemId ?? '').trim();
  const cardId = String(input.cardId ?? '').trim();
  if (!itemId) return { ok: false, error: 'Atividade inválida.' };

  const { error } = await (supabase as any)
    .from('kanban_proximas_atividades')
    .update({ concluido_em: new Date().toISOString(), concluido_por: user.id })
    .eq('id', itemId)
    .eq('card_id', cardId);

  if (error) return { ok: false, error: error.message };

  if (!input.skipRevalidate) {
    const base = String(input.basePath ?? '/').trim() || '/';
    revalidatePath(base);
    revalidatePath('/');
  }

  return { ok: true };
}
