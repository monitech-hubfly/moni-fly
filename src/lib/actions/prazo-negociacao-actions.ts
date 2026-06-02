'use server';

import { revalidatePath } from 'next/cache';
import { isAdminRole } from '@/lib/authz';
import {
  expiraEm24hDesde,
  negociacaoExpirada,
  normalizarPrazoStatus,
  payloadAceitarPrazoTopico,
  type PrazoNegociacaoStatus,
} from '@/lib/kanban/prazo-negociacao';
import { createClient } from '@/lib/supabase/server';

type ActionResult = { ok: true } | { ok: false; error: string };

function dataCampoCalendarioIso(input: string | null | undefined): string | null {
  const t = String(input ?? '').trim();
  if (!t) return null;
  const head = t.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

type TopicoHistoricoEvento = {
  tipo: string;
  em: string;
  por?: string | null;
  detalhe?: string | null;
};

function appendHistoricoEvento(historico: unknown, evento: TopicoHistoricoEvento): TopicoHistoricoEvento[] {
  const base = Array.isArray(historico) ? (historico as TopicoHistoricoEvento[]) : [];
  return [...base, evento];
}

function uniqUuids(ids: string[] | undefined | null): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of ids) {
    const u = String(x ?? '').trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

type TopicoPrazoRow = {
  id: number;
  interacao_id: string | null;
  responsaveis_ids: string[] | null;
  prazo_proposto: string | null;
  prazo_status: string | null;
  prazo_abridor_id: string | null;
  prazo_proposto_por: string | null;
  prazo_negociacao_expira_em: string | null;
  data_fim: string | null;
  historico: unknown;
};

async function carregarTopico(
  supabase: Awaited<ReturnType<typeof createClient>>,
  topicoId: string,
): Promise<TopicoPrazoRow | null> {
  const idNum = Number.parseInt(String(topicoId), 10);
  if (!Number.isFinite(idNum)) return null;
  const { data } = await supabase
    .from('sirene_topicos')
    .select(
      'id, interacao_id, responsaveis_ids, prazo_proposto, prazo_status, prazo_abridor_id, prazo_proposto_por, prazo_negociacao_expira_em, data_fim, historico',
    )
    .eq('id', idNum)
    .maybeSingle();
  return data as TopicoPrazoRow | null;
}

async function carregarInteracaoCriador(
  supabase: Awaited<ReturnType<typeof createClient>>,
  interacaoId: string,
): Promise<{ criado_por: string | null } | null> {
  const { data } = await supabase
    .from('kanban_atividades')
    .select('criado_por')
    .eq('id', interacaoId)
    .maybeSingle();
  return data as { criado_por: string | null } | null;
}

async function usuarioEhAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  return isAdminRole((data as { role?: string } | null)?.role);
}

function podeEditarPrazoLivre(
  row: TopicoPrazoRow,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  return !negociacaoExpirada(row.prazo_negociacao_expira_em);
}

async function atualizarTopicoPrazo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  topicoId: number,
  patch: Record<string, unknown>,
  historico: unknown,
  evento: TopicoHistoricoEvento,
): Promise<ActionResult> {
  const { error } = await supabase
    .from('sirene_topicos')
    .update({
      ...patch,
      historico: appendHistoricoEvento(historico, evento),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', topicoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Responsável aceita o prazo proposto pelo abridor. */
export async function aceitarPrazoSubInteracao(
  topicoId: string,
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const row = await carregarTopico(supabase, topicoId);
  if (!row) return { ok: false, error: 'Atividade não encontrada.' };

  const status = normalizarPrazoStatus(row.prazo_status);
  if (status !== 'pendente_aceite_responsavel') {
    return { ok: false, error: 'Não há prazo aguardando aceite do responsável.' };
  }

  const respIds = uniqUuids(row.responsaveis_ids);
  if (!respIds.includes(user.id)) {
    return { ok: false, error: 'Somente responsáveis podem aceitar este prazo.' };
  }

  const prazo = dataCampoCalendarioIso(row.prazo_proposto);
  if (!prazo) return { ok: false, error: 'Prazo proposto inválido.' };

  const aceite = payloadAceitarPrazoTopico(prazo);
  const r = await atualizarTopicoPrazo(
    supabase,
    row.id,
    aceite,
    row.historico,
    { tipo: 'Prazo aceito', em: new Date().toISOString(), por: user.id, detalhe: prazo },
  );
  if (!r.ok) return r;

  revalidatePath(basePath ?? '/');
  revalidatePath('/sirene/chamados');
  return { ok: true };
}

/** Responsável recusa o prazo proposto. */
export async function recusarPrazoSubInteracao(
  topicoId: string,
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const row = await carregarTopico(supabase, topicoId);
  if (!row) return { ok: false, error: 'Atividade não encontrada.' };

  const status = normalizarPrazoStatus(row.prazo_status);
  if (status !== 'pendente_aceite_responsavel') {
    return { ok: false, error: 'Não há prazo aguardando aceite do responsável.' };
  }

  const respIds = uniqUuids(row.responsaveis_ids);
  if (!respIds.includes(user.id)) {
    return { ok: false, error: 'Somente responsáveis podem recusar este prazo.' };
  }

  const r = await atualizarTopicoPrazo(
    supabase,
    row.id,
    { prazo_status: 'recusado' as PrazoNegociacaoStatus },
    row.historico,
    { tipo: 'Prazo recusado', em: new Date().toISOString(), por: user.id },
  );
  if (!r.ok) return r;

  revalidatePath(basePath ?? '/');
  revalidatePath('/sirene/chamados');
  return { ok: true };
}

/**
 * Nova proposta de prazo:
 * - após recusa: responsável propõe → pendente_aceite_abridor
 * - abridor repropõe após recusa ou na janela de 24h
 */
export async function proporPrazoSubInteracao(
  topicoId: string,
  novaData: string,
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const prazo = dataCampoCalendarioIso(novaData);
  if (!prazo) return { ok: false, error: 'Informe uma data válida.' };

  const row = await carregarTopico(supabase, topicoId);
  if (!row) return { ok: false, error: 'Atividade não encontrada.' };

  const isAdmin = await usuarioEhAdmin(supabase, user.id);
  if (!podeEditarPrazoLivre(row, isAdmin)) {
    return {
      ok: false,
      error: 'A janela de 24h para alterar o prazo expirou. Solicite um administrador.',
    };
  }

  const status = normalizarPrazoStatus(row.prazo_status);
  const respIds = uniqUuids(row.responsaveis_ids);
  const abridorId = String(row.prazo_abridor_id ?? '').trim();
  let interacaoCriador: string | null = null;
  if (row.interacao_id) {
    const inter = await carregarInteracaoCriador(supabase, row.interacao_id);
    interacaoCriador = String(inter?.criado_por ?? '').trim() || null;
  }
  const abridorEfetivo = abridorId || interacaoCriador || '';

  const ehResponsavel = respIds.includes(user.id);
  const ehAbridor = abridorEfetivo === user.id || row.prazo_proposto_por === user.id;

  let novoStatus: PrazoNegociacaoStatus;
  if (status === 'recusado' || status === 'pendente_aceite_abridor') {
    if (!ehResponsavel && !isAdmin) {
      return { ok: false, error: 'Somente o responsável pode propor um novo prazo após recusa.' };
    }
    novoStatus = 'pendente_aceite_abridor';
  } else if (status === 'pendente_aceite_responsavel' || status === 'aceito' || status == null) {
    if (!ehAbridor && !isAdmin) {
      return { ok: false, error: 'Somente quem abriu a atividade pode alterar o prazo nesta etapa.' };
    }
    novoStatus = 'pendente_aceite_responsavel';
  } else {
    return { ok: false, error: 'Estado de prazo não permite nova proposta.' };
  }

  const patch: Record<string, unknown> = {
    prazo_proposto: prazo,
    prazo_status: novoStatus,
    prazo_proposto_por: user.id,
    data_fim: null,
    ...(abridorEfetivo && !row.prazo_abridor_id ? { prazo_abridor_id: abridorEfetivo } : {}),
    ...(!row.prazo_negociacao_expira_em ? { prazo_negociacao_expira_em: expiraEm24hDesde() } : {}),
  };

  const r = await atualizarTopicoPrazo(supabase, row.id, patch, row.historico, {
    tipo: 'Prazo proposto',
    em: new Date().toISOString(),
    por: user.id,
    detalhe: prazo,
  });
  if (!r.ok) return r;

  revalidatePath(basePath ?? '/');
  revalidatePath('/sirene/chamados');
  return { ok: true };
}

/** Abridor aceita contraproposta do responsável. */
export async function aceitarPrazoSubInteracaoComoAbridor(
  topicoId: string,
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const row = await carregarTopico(supabase, topicoId);
  if (!row) return { ok: false, error: 'Atividade não encontrada.' };

  const status = normalizarPrazoStatus(row.prazo_status);
  if (status !== 'pendente_aceite_abridor') {
    return { ok: false, error: 'Não há contraproposta aguardando seu aceite.' };
  }

  const abridorId = String(row.prazo_abridor_id ?? '').trim();
  let interacaoCriador: string | null = null;
  if (row.interacao_id) {
    const inter = await carregarInteracaoCriador(supabase, row.interacao_id);
    interacaoCriador = String(inter?.criado_por ?? '').trim() || null;
  }
  const isAdmin = await usuarioEhAdmin(supabase, user.id);
  if (user.id !== abridorId && user.id !== interacaoCriador && !isAdmin) {
    return { ok: false, error: 'Somente quem abriu a atividade pode aceitar esta proposta.' };
  }

  const prazo = dataCampoCalendarioIso(row.prazo_proposto);
  if (!prazo) return { ok: false, error: 'Prazo proposto inválido.' };

  const aceite = payloadAceitarPrazoTopico(prazo);
  const r = await atualizarTopicoPrazo(
    supabase,
    row.id,
    aceite,
    row.historico,
    { tipo: 'Prazo aceito (abridor)', em: new Date().toISOString(), por: user.id, detalhe: prazo },
  );
  if (!r.ok) return r;

  revalidatePath(basePath ?? '/');
  revalidatePath('/sirene/chamados');
  return { ok: true };
}

/** Admin redefine prazo (aceito imediatamente). */
export async function adminOverridePrazoSubInteracao(
  topicoId: string,
  novaData: string,
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  if (!(await usuarioEhAdmin(supabase, user.id))) {
    return { ok: false, error: 'Somente administradores podem alterar o prazo após a janela de 24h.' };
  }

  const prazo = dataCampoCalendarioIso(novaData);
  if (!prazo) return { ok: false, error: 'Informe uma data válida.' };

  const row = await carregarTopico(supabase, topicoId);
  if (!row) return { ok: false, error: 'Atividade não encontrada.' };

  const aceite = payloadAceitarPrazoTopico(prazo);
  const r = await atualizarTopicoPrazo(supabase, row.id, {
    ...aceite,
    prazo_proposto_por: user.id,
    prazo_negociacao_expira_em: row.prazo_negociacao_expira_em ?? expiraEm24hDesde(),
  }, row.historico, {
    tipo: 'Prazo alterado (admin)',
    em: new Date().toISOString(),
    por: user.id,
    detalhe: prazo,
  });
  if (!r.ok) return r;

  revalidatePath(basePath ?? '/');
  revalidatePath('/sirene/chamados');
  return { ok: true };
}
