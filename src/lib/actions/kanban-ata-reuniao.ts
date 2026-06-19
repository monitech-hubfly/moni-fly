'use server';

import { revalidatePath } from 'next/cache';
import type { AcaoAtaReuniao, AtaReuniaoRow, ConteudoAtaReuniao } from '@/lib/kanban/ata-reuniao-types';
import { dataIsoInputValida } from '@/lib/kanban/kanban-card-datas';
import { propagarCamposKanbanCards } from '@/lib/kanban/card-sync-group';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type KanbanAtaActionResult = { ok: true } | { ok: false; error: string };

async function espelharDataFollowupEmProcesso(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
  valor: string | null,
): Promise<void> {
  const { data: card } = await supabase
    .from('kanban_cards')
    .select('projeto_id')
    .eq('id', cardId)
    .maybeSingle();
  const ids = new Set<string>([cardId]);
  const pid = String((card as { projeto_id?: string | null } | null)?.projeto_id ?? '').trim();
  if (pid) ids.add(pid);
  await supabase
    .from('processo_step_one')
    .update({ data_followup: valor, updated_at: new Date().toISOString() } as never)
    .in('id', [...ids]);
}

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
  const assuntoColuna = row.assunto != null ? String(row.assunto).trim() : '';
  return {
    id: String(row.id),
    card_id: String(row.card_id),
    card_origem: row.card_origem === 'legado' ? 'legado' : 'nativo',
    data_reuniao: String(row.data_reuniao ?? '').slice(0, 10),
    assunto: assuntoColuna || conteudo.assunto.trim() || 'Reunião',
    conteudo,
    preenchido_por: preenchidoPor,
    preenchido_nome: preenchidoPor ? nomePorId.get(preenchidoPor) ?? null : null,
    created_at: String(row.created_at ?? ''),
  };
}

const ATA_SELECT_BASE =
  'id, card_id, card_origem, data_reuniao, conteudo, preenchido_por, created_at';

async function queryAtasReuniaoCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
  origem: 'nativo' | 'legado',
) {
  const withAssunto = await supabase
    .from('kanban_card_atas_reuniao')
    .select(`${ATA_SELECT_BASE}, assunto`)
    .eq('card_id', cardId)
    .eq('card_origem', origem)
    .order('data_reuniao', { ascending: false })
    .order('created_at', { ascending: false });

  if (!withAssunto.error) return withAssunto;

  if (/assunto/i.test(withAssunto.error.message)) {
    return supabase
      .from('kanban_card_atas_reuniao')
      .select(ATA_SELECT_BASE)
      .eq('card_id', cardId)
      .eq('card_origem', origem)
      .order('data_reuniao', { ascending: false })
      .order('created_at', { ascending: false });
  }

  return withAssunto;
}

export async function listarAtasReuniaoCard(input: {
  cardId: string;
  origem: 'nativo' | 'legado';
}): Promise<AtaReuniaoRow[]> {
  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return [];

  const supabase = await createClient();
  const { data, error } = await queryAtasReuniaoCard(supabase, cardId, input.origem);

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

  const payloadBase = {
    card_id: cardId,
    card_origem: input.origem,
    data_reuniao: dataReuniao,
    conteudo,
    preenchido_por: user.id,
  };

  let insErr = (
    await supabase.from('kanban_card_atas_reuniao').insert({ ...payloadBase, assunto } as never)
  ).error;

  if (insErr && /assunto/i.test(insErr.message)) {
    insErr = (await supabase.from('kanban_card_atas_reuniao').insert(payloadBase as never)).error;
  }

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
    await espelharDataFollowupEmProcesso(admin as unknown as Awaited<ReturnType<typeof createClient>>, cardId, valor);
  } else {
    const q =
      input.origem === 'nativo'
        ? supabase.from('kanban_cards').update({ data_followup: valor }).eq('id', cardId)
        : supabase.from('processo_step_one').update({ data_followup: valor }).eq('id', cardId);

    const { error } = await q;
    if (error) return { ok: false, error: error.message };
    if (input.origem === 'nativo') {
      await espelharDataFollowupEmProcesso(supabase, cardId, valor);
    }
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

function horaReuniaoInputValida(raw: string): string | null {
  const v = String(raw ?? '').trim();
  if (!v) return null;
  if (!/^\d{2}:\d{2}$/.test(v)) return null;
  const [hh, mm] = v.split(':').map(Number);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return v;
}

export async function salvarHoraReuniaoCard(input: {
  cardId: string;
  origem: 'nativo' | 'legado';
  horaReuniao: string;
  basePath?: string;
}): Promise<KanbanAtaActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const raw = String(input.horaReuniao ?? '').trim();
  const valor = raw ? horaReuniaoInputValida(raw) : null;
  if (raw && !valor) return { ok: false, error: 'Horário inválido. Use o formato HH:MM.' };

  if (input.origem === 'nativo' && valor) {
    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
    const sync = await propagarCamposKanbanCards(admin, cardId, { hora_reuniao: valor });
    if (!sync.ok) return { ok: false, error: sync.error };
  } else if (input.origem === 'nativo') {
    const { error } = await supabase.from('kanban_cards').update({ hora_reuniao: valor }).eq('id', cardId);
    if (error) return { ok: false, error: error.message };
  } else {
    return { ok: false, error: 'Horário de reunião disponível apenas em cards nativos.' };
  }

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}
