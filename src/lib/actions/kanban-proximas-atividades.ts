'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type {
  KanbanProximaAtividadeAberta,
  KanbanProximaAtividadeRegistro,
} from '@/components/kanban-shared/types';

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
  responsavelId?: string | null;
  basePath?: string;
  skipRevalidate?: boolean;
};

type ProximaAtividadeRowCompleta = {
  id?: string;
  descricao?: string;
  prazo?: string | null;
  responsavel_id?: string | null;
  criado_em?: string | null;
  criado_por?: string | null;
  concluido_em?: string | null;
  concluido_por?: string | null;
};

function colunaResponsavelAusente(message: string): boolean {
  return /responsavel_id/i.test(message);
}

async function nomesPorProfileIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<Map<string, string>> {
  const nomes = new Map<string, string>();
  const unicos = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unicos.length === 0) return nomes;
  const { data } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, email')
    .in('id', unicos);
  for (const p of (data ?? []) as { id?: string; full_name?: string | null; email?: string | null }[]) {
    const id = String(p.id ?? '');
    const nome = String(p.full_name ?? '').trim() || String(p.email ?? '').trim();
    if (id && nome) nomes.set(id, nome);
  }
  return nomes;
}

/** Histórico completo do card: abertas e concluídas, com prazo e responsável. */
export async function listarProximasAtividadesCard(
  cardId: string,
): Promise<KanbanProximaAtividadeRegistro[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const id = String(cardId ?? '').trim();
  if (!id) return [];

  const comResp = await (supabase as any)
    .from('kanban_proximas_atividades')
    .select('id, descricao, prazo, responsavel_id, criado_em, criado_por, concluido_em, concluido_por')
    .eq('card_id', id)
    .order('criado_em', { ascending: false });

  let rows: ProximaAtividadeRowCompleta[] = [];
  if (comResp.error) {
    if (!colunaResponsavelAusente(String(comResp.error.message ?? ''))) return [];
    const semResp = await (supabase as any)
      .from('kanban_proximas_atividades')
      .select('id, descricao, prazo, criado_em, criado_por, concluido_em, concluido_por')
      .eq('card_id', id)
      .order('criado_em', { ascending: false });
    if (semResp.error) return [];
    rows = (semResp.data ?? []) as ProximaAtividadeRowCompleta[];
  } else {
    rows = (comResp.data ?? []) as ProximaAtividadeRowCompleta[];
  }

  const nomes = await nomesPorProfileIds(
    supabase,
    rows.flatMap((row) => [row.responsavel_id, row.criado_por, row.concluido_por].filter(Boolean) as string[]),
  );

  return rows.map((row) => {
    const responsavelId = row.responsavel_id ? String(row.responsavel_id) : null;
    const criadoPor = row.criado_por ? String(row.criado_por) : null;
    const concluidoPor = row.concluido_por ? String(row.concluido_por) : null;
    return {
      id: String(row.id ?? ''),
      descricao: String(row.descricao ?? ''),
      prazo: (row.prazo as string | null) ?? null,
      responsavelId,
      responsavelNome: responsavelId ? nomes.get(responsavelId) ?? null : null,
      criadoEm: row.criado_em ?? null,
      criadoPorNome: criadoPor ? nomes.get(criadoPor) ?? null : null,
      concluidoEm: row.concluido_em ?? null,
      concluidoPorNome: concluidoPor ? nomes.get(concluidoPor) ?? null : null,
    };
  });
}

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
  const responsavelId = String(input.responsavelId ?? '').trim() || null;
  const baseRow = { card_id: cardId, descricao, prazo, criado_por: user.id };

  let inserted: ProximaAtividadeItemResult | null = null;
  if (responsavelId) {
    const comResp = await (supabase as any)
      .from('kanban_proximas_atividades')
      .insert({ ...baseRow, responsavel_id: responsavelId })
      .select('id, descricao, prazo')
      .single();
    if (comResp.error) {
      if (colunaResponsavelAusente(String(comResp.error.message ?? ''))) {
        return {
          ok: false,
          error: 'Não foi possível gravar o responsável. Aplique a migration 675 no banco de desenvolvimento.',
        };
      }
      return { ok: false, error: comResp.error.message };
    }
    inserted = comResp.data ?? null;
  } else {
    const semResp = await (supabase as any)
      .from('kanban_proximas_atividades')
      .insert(baseRow)
      .select('id, descricao, prazo')
      .single();
    if (semResp.error) return { ok: false, error: semResp.error.message };
    inserted = semResp.data ?? null;
  }

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

  const sync = await sincronizarProximaAtividadeCard(supabase, cardId);

  if (!input.skipRevalidate) {
    const base = String(input.basePath ?? '/').trim() || '/';
    revalidatePath(base);
    revalidatePath('/');
  }

  return { ok: true, ...sync };
}

/** Atualiza só o responsável. Não altera descrição, prazo nem conclusão. */
export async function definirResponsavelProximaAtividadeItem(input: {
  itemId: string;
  cardId: string;
  responsavelId?: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const itemId = String(input.itemId ?? '').trim();
  const cardId = String(input.cardId ?? '').trim();
  if (!itemId || !cardId) return { ok: false, error: 'Atividade inválida.' };

  const responsavelId = String(input.responsavelId ?? '').trim() || null;
  const { error } = await (supabase as any)
    .from('kanban_proximas_atividades')
    .update({ responsavel_id: responsavelId })
    .eq('id', itemId)
    .eq('card_id', cardId);

  if (error) {
    if (colunaResponsavelAusente(String(error.message ?? ''))) {
      return {
        ok: false,
        error: 'Não foi possível gravar o responsável. Aplique a migration 675 no banco de desenvolvimento.',
      };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
