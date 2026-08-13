'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import {
  emptyRedeLoteadorFichaDraft,
  redeLoteadorFichaDraftToPatch,
  redeLoteadorRowToFichaDraft,
  type RedeLoteadorFichaDraft,
} from '@/lib/rede-loteador-ficha-draft';
import type { RedeLoteadorRow } from '@/lib/rede-loteadores';
import {
  fetchRedeLoteadorRowById,
  fetchRedeLoteadoresOpcoesLeves,
} from '@/lib/rede-loteadores';
import { criarRedeLoteador, atualizarRedeLoteador } from '@/app/rede-franqueados/rede-loteadores-actions';
import { resolverRedeLoteadorIdNaCadeia } from '@/lib/kanban/card-dados-laterais-pai';

export type RedeLoteadorChecklistModo = 'novo' | 'existente';

export type RedeLoteadorChecklistOpcao = {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  status: string;
};

export type RedeLoteadorChecklistData =
  | {
      ok: true;
      cardRedeLoteadorId: string | null;
      loteador: RedeLoteadorRow | null;
      opcoes: RedeLoteadorChecklistOpcao[];
      modoInicial: RedeLoteadorChecklistModo;
      draftInicial: RedeLoteadorFichaDraft;
    }
  | { ok: false; error: string };

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const access = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (access !== 'admin' && access !== 'team') {
    return { ok: false as const, error: 'Apenas administradores ou time podem gerir loteadores.' };
  }
  return { ok: true as const, supabase, userId: user.id };
}

async function vincularCardELoteador(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
  itemId: string,
  redeLoteadorId: string,
  userId: string,
  nomeExibicao: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: cardErr } = await supabase
    .from('kanban_cards')
    .update({ rede_loteador_id: redeLoteadorId, updated_at: new Date().toISOString() } as never)
    .eq('id', cardId);
  if (cardErr) return { ok: false, error: cardErr.message };

  const { error: respErr } = await supabase.from('kanban_fase_checklist_respostas').upsert(
    {
      item_id: itemId,
      card_id: cardId,
      valor: redeLoteadorId,
      arquivo_path: null,
      preenchido_por: userId,
      preenchido_em: new Date().toISOString(),
    },
    { onConflict: 'item_id,card_id' },
  );
  if (respErr) return { ok: false, error: respErr.message };

  void nomeExibicao;
  return { ok: true };
}

export async function carregarRedeLoteadorChecklistData(cardId: string): Promise<RedeLoteadorChecklistData> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const cid = cardId.trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const { data: cardRow } = await gate.supabase
    .from('kanban_cards')
    .select('rede_loteador_id')
    .eq('id', cid)
    .maybeSingle();

  let cardRedeLoteadorId =
    String((cardRow as { rede_loteador_id?: string | null } | null)?.rede_loteador_id ?? '').trim() || null;
  if (!cardRedeLoteadorId) {
    cardRedeLoteadorId = await resolverRedeLoteadorIdNaCadeia(gate.supabase, cid);
  }

  const loteador = cardRedeLoteadorId
    ? await fetchRedeLoteadorRowById(gate.supabase, cardRedeLoteadorId)
    : null;

  const opcoes: RedeLoteadorChecklistOpcao[] = loteador
    ? [
        {
          id: loteador.id,
          nome: loteador.nome,
          cidade: loteador.cidade,
          estado: loteador.estado,
          status: loteador.status,
        },
      ]
    : [];

  const modoInicial: RedeLoteadorChecklistModo = loteador ? 'existente' : 'novo';
  const draftInicial = loteador
    ? redeLoteadorRowToFichaDraft(loteador)
    : emptyRedeLoteadorFichaDraft('em_analise');

  return {
    ok: true,
    cardRedeLoteadorId,
    loteador,
    opcoes,
    modoInicial,
    draftInicial,
  };
}

export async function salvarRedeLoteadorChecklistFunil(input: {
  cardId: string;
  itemId: string;
  modo: RedeLoteadorChecklistModo;
  redeLoteadorIdSelecionado: string | null;
  draft: RedeLoteadorFichaDraft;
}): Promise<{ ok: true; redeLoteadorId: string; mensagem: string } | { ok: false; error: string }> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const cid = input.cardId.trim();
  const itemId = input.itemId.trim();
  if (!cid || !itemId) return { ok: false, error: 'Card ou item inválido.' };

  const patch = redeLoteadorFichaDraftToPatch(input.draft);
  if (!patch.nome?.trim()) return { ok: false, error: 'Informe o nome do loteador.' };

  let redeLoteadorId = '';

  if (input.modo === 'novo') {
    const criado = await criarRedeLoteador({ ...patch, status: patch.status ?? 'em_analise' });
    if (!criado.ok) return criado;
    redeLoteadorId = criado.id ?? '';
    if (!redeLoteadorId) return { ok: false, error: 'Falha ao obter ID do loteador criado.' };
  } else {
    const sel = String(input.redeLoteadorIdSelecionado ?? '').trim();
    if (!sel) return { ok: false, error: 'Selecione um loteador existente.' };
    const atualizado = await atualizarRedeLoteador(sel, patch);
    if (!atualizado.ok) return atualizado;
    redeLoteadorId = sel;
  }

  const vinc = await vincularCardELoteador(
    gate.supabase,
    cid,
    itemId,
    redeLoteadorId,
    gate.userId,
    patch.nome ?? '',
  );
  if (!vinc.ok) return vinc;

  revalidatePath('/loteadores');
  revalidatePath('/rede-franqueados');

  const mensagem =
    input.modo === 'novo'
      ? 'Loteador cadastrado na Rede de Loteadores e vinculado ao card.'
      : 'Loteador atualizado e vinculado ao card.';

  return { ok: true, redeLoteadorId, mensagem };
}

export async function carregarRedeLoteadorPorId(id: string): Promise<
  { ok: true; loteador: RedeLoteadorRow } | { ok: false; error: string }
> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const lid = id.trim();
  if (!lid) return { ok: false, error: 'ID inválido.' };

  const loteador = await fetchRedeLoteadorRowById(gate.supabase, lid);
  if (!loteador) return { ok: false, error: 'Loteador não encontrado.' };

  return { ok: true, loteador };
}

export async function listarOpcoesRedeLoteadoresChecklist(): Promise<
  { ok: true; opcoes: RedeLoteadorChecklistOpcao[] } | { ok: false; error: string }
> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const opcoes = await fetchRedeLoteadoresOpcoesLeves(gate.supabase);
  if (!opcoes) return { ok: false, error: 'Erro ao carregar loteadores da rede.' };
  return { ok: true, opcoes };
}
