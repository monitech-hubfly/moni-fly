'use server';

import { revalidatePath } from 'next/cache';
import type { AcaoAtaReuniao, AtaReuniaoRow, ConteudoAtaReuniao } from '@/lib/kanban/ata-reuniao-types';
import { dataIsoInputValida } from '@/lib/kanban/kanban-card-datas';
import { propagarCamposKanbanCards } from '@/lib/kanban/card-sync-group';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type KanbanAtaActionResult = { ok: true } | { ok: false; error: string };

function parseConteudo(raw: unknown): ConteudoAtaReuniao {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const acoesRaw = Array.isArray(o.acoes) ? o.acoes : [];
  const acoes: AcaoAtaReuniao[] = acoesRaw.map((a) => {
    const row = a && typeof a === 'object' ? (a as Record<string, unknown>) : {};
    return {
      acao: String(row.acao ?? '').trim(),
      responsavel: String(row.responsavel ?? '').trim(),
      prazo: String(row.prazo ?? '').trim(),
    };
  });
  return {
    participantes: String(o.participantes ?? '').trim(),
    assunto: String(o.assunto ?? '').trim(),
    pontos_chave: String(o.pontos_chave ?? '').trim(),
    decisoes: String(o.decisoes ?? '').trim(),
    acoes: acoes.length ? acoes : [{ acao: '', responsavel: '', prazo: '' }],
    pendencias_riscos: String(o.pendencias_riscos ?? '').trim(),
    proximos_passos: String(o.proximos_passos ?? '').trim(),
  };
}

function mapRow(row: Record<string, unknown>, nomePorId: Map<string, string>): AtaReuniaoRow {
  const conteudo = parseConteudo(row.conteudo);
  const preenchidoPor = row.preenchido_por != null ? String(row.preenchido_por) : null;
  return {
    id: String(row.id),
    card_id: String(row.card_id),
    card_origem: row.card_origem === 'legado' ? 'legado' : 'nativo',
    data_reuniao: String(row.data_reuniao ?? '').slice(0, 10),
    assunto: String(row.assunto ?? conteudo.assunto ?? '').trim() || 'Reunião',
    conteudo,
    preenchido_por: preenchidoPor,
    preenchido_nome: preenchidoPor ? nomePorId.get(preenchidoPor) ?? null : null,
    created_at: String(row.created_at ?? ''),
  };
}

export async function listarAtasReuniaoCard(input: {
  cardId: string;
  origem: 'nativo' | 'legado';
}): Promise<AtaReuniaoRow[]> {
  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('kanban_card_atas_reuniao')
    .select('id, card_id, card_origem, data_reuniao, assunto, conteudo, preenchido_por, created_at')
    .eq('card_id', cardId)
    .eq('card_origem', input.origem)
    .order('data_reuniao', { ascending: false })
    .order('created_at', { ascending: false });

  if (error || !data?.length) return [];

  const ids = [...new Set(data.map((r) => String((r as { preenchido_por?: string | null }).preenchido_por ?? '')).filter(Boolean))];
  const nomePorId = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
    for (const p of profs ?? []) {
      const id = String((p as { id?: string }).id ?? '');
      const nome = String((p as { full_name?: string | null }).full_name ?? '').trim();
      if (id && nome) nomePorId.set(id, nome);
    }
  }

  return data.map((r) => mapRow(r as Record<string, unknown>, nomePorId));
}

export async function salvarAtaReuniaoCard(input: {
  cardId: string;
  origem: 'nativo' | 'legado';
  dataReuniao: string;
  conteudo: ConteudoAtaReuniao;
  basePath?: string;
}): Promise<KanbanAtaActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para registrar a ata.' };

  const cardId = String(input.cardId ?? '').trim();
  const dataReuniao = String(input.dataReuniao ?? '').trim().slice(0, 10);
  const assunto = String(input.conteudo.assunto ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };
  if (!dataReuniao) return { ok: false, error: 'Informe a data da reunião.' };
  if (!assunto) return { ok: false, error: 'Informe o assunto principal da reunião.' };

  const acoesLimpas = (input.conteudo.acoes ?? [])
    .map((a) => ({
      acao: String(a.acao ?? '').trim(),
      responsavel: String(a.responsavel ?? '').trim(),
      prazo: String(a.prazo ?? '').trim(),
    }))
    .filter((a) => a.acao || a.responsavel || a.prazo);

  const conteudo: ConteudoAtaReuniao = {
    ...input.conteudo,
    assunto,
    acoes: acoesLimpas,
  };

  const { error: insErr } = await supabase.from('kanban_card_atas_reuniao').insert({
    card_id: cardId,
    card_origem: input.origem,
    data_reuniao: dataReuniao,
    assunto,
    conteudo,
    preenchido_por: user.id,
  } as never);

  if (insErr) return { ok: false, error: insErr.message };

  const q =
    input.origem === 'nativo'
      ? supabase.from('kanban_cards').update({ data_reuniao: null }).eq('id', cardId)
      : supabase.from('processo_step_one').update({ data_reuniao: null }).eq('id', cardId);

  const { error: updErr } = await q;
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}

export async function salvarDataFollowupCard(input: {
  cardId: string;
  origem: 'nativo' | 'legado';
  dataFollowup: string;
  basePath?: string;
}): Promise<KanbanAtaActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const raw = String(input.dataFollowup ?? '').trim();
  const valor = raw && dataIsoInputValida(raw) ? raw : raw ? null : null;
  if (raw && !valor) return { ok: false, error: 'Data de follow-up inválida. Use o formato completo (dia/mês/ano).' };

  if (input.origem === 'nativo' && valor) {
    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
    const sync = await propagarCamposKanbanCards(admin, cardId, { data_followup: valor });
    if (!sync.ok) return { ok: false, error: sync.error };
  } else {
    const q =
      input.origem === 'nativo'
        ? supabase.from('kanban_cards').update({ data_followup: valor }).eq('id', cardId)
        : supabase.from('processo_step_one').update({ data_followup: valor }).eq('id', cardId);

    const { error } = await q;
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}

export async function salvarDataReuniaoCard(input: {
  cardId: string;
  origem: 'nativo' | 'legado';
  dataReuniao: string;
  basePath?: string;
}): Promise<KanbanAtaActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const raw = String(input.dataReuniao ?? '').trim();
  const valor = raw && dataIsoInputValida(raw) ? raw : raw ? null : null;
  if (raw && !valor) return { ok: false, error: 'Data de reunião inválida. Informe o ano completo (4 dígitos).' };

  if (input.origem === 'nativo' && valor) {
    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
    const sync = await propagarCamposKanbanCards(admin, cardId, { data_reuniao: valor });
    if (!sync.ok) return { ok: false, error: sync.error };
  } else {
    const q =
      input.origem === 'nativo'
        ? supabase.from('kanban_cards').update({ data_reuniao: valor }).eq('id', cardId)
        : supabase.from('processo_step_one').update({ data_reuniao: valor }).eq('id', cardId);

    const { error } = await q;
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}
