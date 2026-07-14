'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import {
  calcularScoreLoteadorR1,
  classificarLoteadorR1,
  LOTEADORES_R1_CALCULADO_SLUGS,
  LOTEADORES_R1_SCORE_SLUGS,
} from '@/lib/kanban/loteadores-score-r1';
import { formatInteresseLoteadorR1 } from '@/lib/kanban/loteadores-r1-conceito';
import {
  emptyRedeLoteadorFichaDraft,
  redeLoteadorFichaDraftToPatch,
  redeLoteadorRowToFichaDraft,
  type RedeLoteadorFichaDraft,
} from '@/lib/rede-loteador-ficha-draft';
import { fetchRedeLoteadoresRows } from '@/lib/rede-loteadores';
import { getNextCodigoLoteador } from '@/lib/next-codigo-loteador';
import { criarRedeLoteador, atualizarRedeLoteador } from '@/app/rede-franqueados/rede-loteadores-actions';
import type { RedeLoteadorChecklistModo } from '@/lib/actions/kanban-rede-loteador-checklist';
import { sincronizarTituloCardLoteadores } from '@/lib/kanban/loteadores-card-titulo';

export type LoteadorExternoTokenInfo =
  | { ok: true; card_id: string; rede_loteador_id: string | null; expires_at: string | null }
  | { ok: false; error: string };

export async function buscarLoteadorExternoTokenInfo(token: string): Promise<LoteadorExternoTokenInfo> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Serviço indisponível.' };
  }

  const { data, error } = await admin
    .from('kanban_loteador_externo_tokens')
    .select('card_id, expires_at')
    .eq('token', token.trim())
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Link inválido.' };

  const row = data as { card_id: string; expires_at: string | null };
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { ok: false, error: 'Este link expirou.' };
  }

  const { data: card } = await admin
    .from('kanban_cards')
    .select('rede_loteador_id')
    .eq('id', row.card_id)
    .maybeSingle();

  return {
    ok: true,
    card_id: row.card_id,
    rede_loteador_id: (card as { rede_loteador_id?: string | null } | null)?.rede_loteador_id ?? null,
    expires_at: row.expires_at,
  };
}

function buildLoteadorExternoUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, '')}` : '') ||
    'https://rede.moni';
  const origin = base.startsWith('http') ? base : `https://${base}`;
  return `${origin}/loteador/${token}`;
}

export async function obterOuGerarLinkExternoLoteador(cardId: string): Promise<
  { ok: true; url: string; token: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cid = cardId.trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const { data: existing } = await supabase
    .from('kanban_loteador_externo_tokens')
    .select('token')
    .eq('card_id', cid)
    .maybeSingle();

  let token = String((existing as { token?: string } | null)?.token ?? '').trim();
  if (!token) {
    const { data: inserted, error } = await supabase
      .from('kanban_loteador_externo_tokens')
      .insert({ card_id: cid })
      .select('token')
      .single();
    if (error) return { ok: false, error: error.message };
    token = String((inserted as { token: string }).token);
  }

  return { ok: true, url: buildLoteadorExternoUrl(token), token };
}

export async function carregarFichaLoteadorExterna(token: string): Promise<
  | {
      ok: true;
      cardId: string;
      draft: RedeLoteadorFichaDraft;
      redeLoteadorId: string | null;
      updatedAt: string | null;
    }
  | { ok: false; error: string }
> {
  const info = await buscarLoteadorExternoTokenInfo(token);
  if (!info.ok) return info;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Serviço indisponível.' };
  }

  const rid = info.rede_loteador_id;
  if (!rid) {
    return {
      ok: true,
      cardId: info.card_id,
      draft: emptyRedeLoteadorFichaDraft('em_analise'),
      redeLoteadorId: null,
      updatedAt: null,
    };
  }

  const rows = await fetchRedeLoteadoresRows(admin as never);
  const loteador = rows?.find((r) => r.id === rid) ?? null;
  if (!loteador) {
    return {
      ok: true,
      cardId: info.card_id,
      draft: emptyRedeLoteadorFichaDraft('em_analise'),
      redeLoteadorId: rid,
      updatedAt: null,
    };
  }

  return {
    ok: true,
    cardId: info.card_id,
    draft: redeLoteadorRowToFichaDraft(loteador),
    redeLoteadorId: rid,
    updatedAt: loteador.updated_at ?? null,
  };
}

export async function salvarFichaLoteadorExterna(input: {
  token: string;
  draft: RedeLoteadorFichaDraft;
}): Promise<{ ok: true; redeLoteadorId: string } | { ok: false; error: string }> {
  const info = await buscarLoteadorExternoTokenInfo(input.token);
  if (!info.ok) return info;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Serviço indisponível.' };
  }

  const patch = redeLoteadorFichaDraftToPatch(input.draft);
  if (!patch.nome?.trim()) return { ok: false, error: 'Informe o nome do loteador.' };

  const now = new Date().toISOString();
  let redeLoteadorId = info.rede_loteador_id ?? '';

  if (!redeLoteadorId) {
    const codigo = await getNextCodigoLoteador(admin as never);
    const { data: inserted, error } = await admin
      .from('rede_loteadores')
      .insert({
        ...patch,
        codigo,
        status: patch.status ?? 'em_analise',
        condominio_estado: patch.estado ?? null,
        updated_at: now,
      })
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message };
    redeLoteadorId = String((inserted as { id: string }).id);

    await admin
      .from('kanban_cards')
      .update({ rede_loteador_id: redeLoteadorId, updated_at: now })
      .eq('id', info.card_id);
  } else {
    const { error } = await admin
      .from('rede_loteadores')
      .update({
        ...patch,
        condominio_estado: patch.estado ?? null,
        updated_at: now,
      })
      .eq('id', redeLoteadorId);
    if (error) return { ok: false, error: error.message };

    await admin.from('kanban_cards').update({ updated_at: now }).eq('id', info.card_id);
  }

  return { ok: true, redeLoteadorId };
}

async function requireStaffForPersistente() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
  const access = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (access !== 'admin' && access !== 'team') {
    return { ok: false as const, error: 'Sem permissão.' };
  }
  return {
    ok: true as const,
    supabase,
    userId: user.id,
    userName: String((profile as { full_name?: string | null } | null)?.full_name ?? '').trim() || 'Usuário',
  };
}

export async function salvarRedeLoteadorPersistenteCard(input: {
  cardId: string;
  modo: RedeLoteadorChecklistModo;
  redeLoteadorIdSelecionado: string | null;
  draft: RedeLoteadorFichaDraft;
}): Promise<
  | { ok: true; redeLoteadorId: string; mensagem: string; updatedAt: string }
  | { ok: false; error: string }
> {
  const gate = await requireStaffForPersistente();
  if (!gate.ok) return gate;

  const cid = input.cardId.trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const patch = redeLoteadorFichaDraftToPatch(input.draft);
  if (!patch.nome?.trim()) return { ok: false, error: 'Informe o nome do loteador.' };

  let redeLoteadorId = '';

  if (input.modo === 'novo') {
    const criado = await criarRedeLoteador({ ...patch, status: patch.status ?? 'em_analise' });
    if (!criado.ok) return criado;
    redeLoteadorId = criado.id ?? '';
    if (!redeLoteadorId) return { ok: false, error: 'Falha ao criar loteador.' };
  } else {
    const sel = String(input.redeLoteadorIdSelecionado ?? '').trim();
    if (!sel) return { ok: false, error: 'Selecione um loteador existente.' };
    const atualizado = await atualizarRedeLoteador(sel, patch);
    if (!atualizado.ok) return atualizado;
    redeLoteadorId = sel;
  }

  const now = new Date().toISOString();
  await gate.supabase
    .from('rede_loteadores')
    .update({ ultima_atualizacao_por: gate.userId, updated_at: now, condominio_estado: patch.estado ?? null })
    .eq('id', redeLoteadorId);

  const { data: cardAtual } = await gate.supabase
    .from('kanban_cards')
    .select('nome_condominio, quadra, lote')
    .eq('id', cid)
    .maybeSingle();

  const patchCondominio = String(patch.condominio_nome ?? '').trim();
  const updateCard: Record<string, unknown> = {
    rede_loteador_id: redeLoteadorId,
    updated_at: now,
  };
  if (patchCondominio && !String((cardAtual as { nome_condominio?: string | null } | null)?.nome_condominio ?? '').trim()) {
    updateCard.nome_condominio = patchCondominio;
  }

  const { error: cardErr } = await gate.supabase.from('kanban_cards').update(updateCard).eq('id', cid);
  if (cardErr) return { ok: false, error: cardErr.message };

  const syncTitulo = await sincronizarTituloCardLoteadores(gate.supabase, cid);
  if (!syncTitulo.ok) return syncTitulo;

  revalidatePath('/loteadores');
  revalidatePath('/rede-franqueados');

  const mensagem =
    input.modo === 'novo'
      ? 'Loteador cadastrado e vinculado ao card.'
      : 'Dados do loteador atualizados.';

  return { ok: true, redeLoteadorId, mensagem, updatedAt: now };
}

/** Recalcula score/classificação R1 após alteração de campos de entrada. */
export async function atualizarScoreLoteadorR1(cardId: string): Promise<void> {
  const supabase = await createClient();
  const cid = cardId.trim();
  if (!cid) return;

  const { data: faseRow } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('slug', 'r1_conceito_moni_inc')
    .maybeSingle();
  const faseId = (faseRow as { id?: string } | null)?.id;
  if (!faseId) return;

  const { data: itens } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id, campo_slug')
    .eq('fase_id', faseId)
    .in('campo_slug', [...LOTEADORES_R1_SCORE_SLUGS, ...LOTEADORES_R1_CALCULADO_SLUGS]);

  const rows = (itens ?? []) as { id: string; campo_slug: string | null }[];
  if (rows.length === 0) return;

  const bySlug = new Map(rows.map((r) => [String(r.campo_slug ?? ''), r.id]));
  const itemIds = rows.map((r) => r.id);

  const { data: resps } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('item_id, valor')
    .eq('card_id', cid)
    .in('item_id', itemIds);

  const valores = new Map(
    ((resps ?? []) as { item_id: string; valor: string | null }[]).map((r) => [r.item_id, r.valor]),
  );

  const input = {
    preco_atratividade: valores.get(bySlug.get('preco_atratividade') ?? '') ?? null,
    produto_atratividade: valores.get(bySlug.get('produto_atratividade') ?? '') ?? null,
    showroom_interesse: valores.get(bySlug.get('showroom_interesse') ?? '') ?? null,
    linhas_receita: valores.get(bySlug.get('linhas_receita') ?? '') ?? null,
  };

  const score = calcularScoreLoteadorR1(input);
  const classificacao = classificarLoteadorR1(score);
  const interesse = formatInteresseLoteadorR1(score, classificacao);
  const now = new Date().toISOString();

  for (const u of [
    { slug: 'interesse_loteador', valor: interesse },
    { slug: 'score_loteador', valor: String(score) },
    { slug: 'classificacao_loteador', valor: classificacao },
  ]) {
    const itemId = bySlug.get(u.slug);
    if (!itemId) continue;
    await supabase.from('kanban_fase_checklist_respostas').upsert(
      {
        item_id: itemId,
        card_id: cid,
        valor: u.valor,
        preenchido_em: now,
      },
      { onConflict: 'item_id,card_id' },
    );
  }
}
