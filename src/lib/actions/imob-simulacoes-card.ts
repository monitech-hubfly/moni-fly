'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isRedeStaffRole, normalizeAccessRole } from '@/lib/authz';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  draftToImobPatch,
  rowToImobDraft,
  type ImobCardEmpreendimentoDraft,
  type ImobCardEmpreendimentoRow,
} from '@/lib/kanban/imob-simulacoes-card';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  return { ok: true as const, supabase, userId: user.id, isStaff: isRedeStaffRole(normalizeAccessRole(role)) };
}

async function assertCardLoteadores(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.from('kanban_cards').select('id, kanban_id').eq('id', cardId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Card não encontrado.' };
  if (String((data as { kanban_id?: string }).kanban_id ?? '') !== KANBAN_IDS.LOTEADORES) {
    return { ok: false, error: 'Simulações IMOB só existem no Funil Loteadores.' };
  }
  return { ok: true };
}

function mapRow(raw: Record<string, unknown>): ImobCardEmpreendimentoRow {
  const n = (k: string) => {
    const v = raw[k];
    if (v == null || v === '') return null;
    const num = Number(v);
    return Number.isFinite(num) ? num : null;
  };
  return {
    id: String(raw.id),
    card_id: String(raw.card_id),
    ordem: Number(raw.ordem ?? 0),
    nome: raw.nome != null ? String(raw.nome) : null,
    valor_avista: n('valor_avista'),
    balao_parcial_8: n('balao_parcial_8'),
    balao_parcial_18: n('balao_parcial_18'),
    balao_parcial_24: n('balao_parcial_24'),
    balao_quitado_8: n('balao_quitado_8'),
    balao_quitado_18: n('balao_quitado_18'),
    balao_quitado_24: n('balao_quitado_24'),
    balao_lote_8: n('balao_lote_8'),
    balao_lote_18: n('balao_lote_18'),
    balao_lote_24: n('balao_lote_24'),
    fin_parcial_valor: n('fin_parcial_valor'),
    fin_parcial_p1: n('fin_parcial_p1'),
    fin_parcial_ultima: n('fin_parcial_ultima'),
    fin_parcial_total: n('fin_parcial_total'),
    fin_quitado_valor: n('fin_quitado_valor'),
    fin_quitado_p1: n('fin_quitado_p1'),
    fin_quitado_ultima: n('fin_quitado_ultima'),
    fin_quitado_total: n('fin_quitado_total'),
    fin_lote_valor: n('fin_lote_valor'),
    fin_lote_p1: n('fin_lote_p1'),
    fin_lote_ultima: n('fin_lote_ultima'),
    fin_lote_total: n('fin_lote_total'),
  };
}

export async function listarImobSimulacoesCard(
  cardId: string,
): Promise<{ ok: true; itens: ImobCardEmpreendimentoDraft[] } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const check = await assertCardLoteadores(auth.supabase, cardId);
  if (!check.ok) return check;

  const { data, error } = await auth.supabase
    .from('imob_card_empreendimentos')
    .select('*')
    .eq('card_id', cardId)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return { ok: false, error: error.message };
  const itens = (data ?? []).map((r) => rowToImobDraft(mapRow(r as Record<string, unknown>)));
  return { ok: true, itens };
}

export async function criarImobSimulacaoEmpreendimento(
  cardId: string,
): Promise<{ ok: true; item: ImobCardEmpreendimentoDraft } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!auth.isStaff) return { ok: false, error: 'Apenas admin/team podem editar Simulações IMOB.' };
  const check = await assertCardLoteadores(auth.supabase, cardId);
  if (!check.ok) return check;

  const { data: maxRow } = await auth.supabase
    .from('imob_card_empreendimentos')
    .select('ordem')
    .eq('card_id', cardId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordem = Number((maxRow as { ordem?: number } | null)?.ordem ?? -1) + 1;

  const { data, error } = await auth.supabase
    .from('imob_card_empreendimentos')
    .insert({ card_id: cardId, ordem, nome: '' })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Não foi possível criar o empreendimento.' };
  revalidatePath('/loteadores');
  return { ok: true, item: rowToImobDraft(mapRow(data as Record<string, unknown>)) };
}

export async function salvarImobSimulacaoEmpreendimento(
  cardId: string,
  draft: ImobCardEmpreendimentoDraft,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!auth.isStaff) return { ok: false, error: 'Apenas admin/team podem editar Simulações IMOB.' };
  const check = await assertCardLoteadores(auth.supabase, cardId);
  if (!check.ok) return check;

  const { error } = await auth.supabase
    .from('imob_card_empreendimentos')
    .update(draftToImobPatch(draft) as never)
    .eq('id', draft.id)
    .eq('card_id', cardId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/loteadores');
  return { ok: true };
}

export async function excluirImobSimulacaoEmpreendimento(
  cardId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!auth.isStaff) return { ok: false, error: 'Apenas admin/team podem editar Simulações IMOB.' };
  const check = await assertCardLoteadores(auth.supabase, cardId);
  if (!check.ok) return check;

  const { error } = await auth.supabase
    .from('imob_card_empreendimentos')
    .delete()
    .eq('id', id)
    .eq('card_id', cardId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/loteadores');
  return { ok: true };
}
