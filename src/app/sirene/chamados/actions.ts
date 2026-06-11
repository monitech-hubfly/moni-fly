'use server';

import { revalidatePath } from 'next/cache';
import {
  conteudoPersistivelComentario,
  htmlComentarioParaTextoPlano,
} from '@/lib/kanban/mencao-comentario';
import {
  notificarMencoesSirene,
  resolverMencoesSirene,
} from '@/lib/actions/sirene-mencoes';
import { concluirChamadoCriador } from '@/app/sirene/actions';
import { todosTopicosFechados } from '@/lib/sirene/chamado-regras';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type AtualizarStatusInteracaoResult = { ok: true } | { ok: false; error: string };

/** Status persistidos em `kanban_atividades.status`. */
export type StatusInteracaoDb = 'pendente' | 'em_andamento' | 'concluida';

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

/** Data `YYYY-MM-DD` do `<input type="date">` sem conversão timezone. */
function dataCampoCalendarioIso(input: string | null | undefined): string | null {
  const t = String(input ?? '').trim();
  if (!t) return null;
  const head = t.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

async function usuarioPodeEditarAtividade(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  row: {
    origem: string;
    card_id: string | null;
    responsavel_id: string | null;
    responsaveis_ids: unknown;
    criado_por: string | null;
  },
): Promise<boolean> {
  const { data: prof } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  const role = String((prof as { role?: string } | null)?.role ?? '');
  if (role === 'admin' || role === 'consultor' || role === 'team' || role === 'supervisor') return true;

  const ids = Array.isArray(row.responsaveis_ids)
    ? (row.responsaveis_ids as unknown[]).map((x) => String(x))
    : [];
  if (row.responsavel_id && String(row.responsavel_id) === userId) return true;
  if (ids.includes(userId)) return true;
  if (row.criado_por && String(row.criado_por) === userId) return true;

  const origem = String(row.origem ?? 'nativo');

  if (origem === 'sirene') {
    const { data: sp } = await admin
      .from('sirene_papeis')
      .select('papel')
      .eq('user_id', userId)
      .maybeSingle();
    const papel = String((sp as { papel?: string } | null)?.papel ?? '');
    if (papel === 'bombeiro' || papel === 'caneta_verde') return true;
  }

  if (origem === 'externo') {
    return false;
  }

  if (!row.card_id) return false;

  if (origem === 'nativo') {
    const { data: card } = await admin
      .from('kanban_cards')
      .select('franqueado_id')
      .eq('id', row.card_id)
      .maybeSingle();
    return Boolean(card && String((card as { franqueado_id?: string }).franqueado_id) === userId);
  }

  if (origem === 'legado') {
    const { data: p } = await admin
      .from('processo_step_one')
      .select('user_id')
      .eq('id', row.card_id)
      .maybeSingle();
    return Boolean(p && String((p as { user_id?: string }).user_id) === userId);
  }

  return false;
}

export async function atualizarStatusInteracaoSirene(
  atividadeId: string,
  status: StatusInteracaoDb,
  opts?: { infoConclusaoCriador?: string; resolucaoSuficiente?: boolean },
): Promise<AtualizarStatusInteracaoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from('kanban_atividades')
    .select('id, origem, card_id, responsavel_id, responsaveis_ids, criado_por, sirene_chamado_id')
    .eq('id', atividadeId)
    .maybeSingle();

  if (fetchErr || !row) return { ok: false, error: 'Chamado não encontrado.' };

  const ok = await usuarioPodeEditarAtividade(admin, user.id, {
    origem: String((row as { origem?: string }).origem ?? 'nativo'),
    card_id: (row as { card_id?: string | null }).card_id ?? null,
    responsavel_id: (row as { responsavel_id?: string | null }).responsavel_id ?? null,
    responsaveis_ids: (row as { responsaveis_ids?: unknown }).responsaveis_ids,
    criado_por: (row as { criado_por?: string | null }).criado_por ?? null,
  });
  if (!ok) return { ok: false, error: 'Sem permissão para alterar este chamado.' };

  if (status === 'em_andamento') {
    return { ok: false, error: 'O status em andamento é definido automaticamente pelas atividades.' };
  }

  if (status === 'concluida') {
    const criador = String((row as { criado_por?: string | null }).criado_por ?? '');
    if (criador && criador !== user.id) {
      return { ok: false, error: 'Somente quem abriu o chamado pode marcá-lo como concluído.' };
    }

    const { data: subs } = await admin
      .from('sirene_topicos')
      .select('status')
      .eq('interacao_id', atividadeId)
      .eq('arquivado', false);
    if (!todosTopicosFechados(subs ?? [])) {
      return { ok: false, error: 'Conclua todas as sub-interações antes de concluir o chamado.' };
    }

    const texto = opts?.infoConclusaoCriador?.trim();
    if (!texto) {
      return { ok: false, error: 'Informe as informações da conclusão do chamado.' };
    }

    const sireneCid = (row as { sirene_chamado_id?: number | null }).sirene_chamado_id;
    const suficiente = opts?.resolucaoSuficiente !== false;

    if (sireneCid != null && Number.isFinite(Number(sireneCid))) {
      const r = await concluirChamadoCriador(Number(sireneCid), suficiente, texto);
      if (!r.ok) return r;
      revalidatePath('/sirene/chamados');
      revalidatePath('/');
      return { ok: true };
    }

    const now = new Date().toISOString();
    if (suficiente) {
      const { error } = await admin
        .from('kanban_atividades')
        .update({
          status: 'concluida',
          concluida_em: now,
          info_conclusao_criador: texto,
          updated_at: now,
        })
        .eq('id', atividadeId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await admin
        .from('kanban_atividades')
        .update({
          status: 'em_andamento',
          concluida_em: null,
          info_conclusao_criador: null,
          updated_at: now,
        })
        .eq('id', atividadeId);
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath('/sirene/chamados');
    revalidatePath('/');
    return { ok: true };
  }

  const { error } = await admin
    .from('kanban_atividades')
    .update({
      status,
      concluida_em: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', atividadeId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/sirene/chamados');
  revalidatePath('/');
  return { ok: true };
}

export type AtualizarInteracaoCompletaSireneInput = {
  titulo: string;
  tipo: 'atividade' | 'duvida' | 'proposicoes';
  data_vencimento: string | null;
  times_ids: string[];
  responsaveis_ids: string[];
  trava: boolean;
};

export async function atualizarInteracaoCompletaSirene(
  atividadeId: string,
  dados: AtualizarInteracaoCompletaSireneInput,
): Promise<AtualizarStatusInteracaoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const titulo = String(dados.titulo ?? '').trim();
  if (!titulo) return { ok: false, error: 'Informe o título.' };

  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from('kanban_atividades')
    .select('id, origem, card_id, responsavel_id, responsaveis_ids, criado_por')
    .eq('id', atividadeId)
    .maybeSingle();

  if (fetchErr || !row) return { ok: false, error: 'Chamado não encontrado.' };

  const pode = await usuarioPodeEditarAtividade(admin, user.id, {
    origem: String((row as { origem?: string }).origem ?? 'nativo'),
    card_id: (row as { card_id?: string | null }).card_id ?? null,
    responsavel_id: (row as { responsavel_id?: string | null }).responsavel_id ?? null,
    responsaveis_ids: (row as { responsaveis_ids?: unknown }).responsaveis_ids,
    criado_por: (row as { criado_por?: string | null }).criado_por ?? null,
  });
  if (!pode) return { ok: false, error: 'Sem permissão para editar este chamado.' };

  const timesIds = uniqUuids(dados.times_ids);
  const mergedResp = uniqUuids(dados.responsaveis_ids);
  const responsavelSingular = mergedResp.length > 0 ? mergedResp[0]! : null;

  const { error } = await admin
    .from('kanban_atividades')
    .update({
      titulo,
      tipo: dados.tipo === 'duvida' ? 'duvida' : dados.tipo === 'proposicoes' ? 'proposicoes' : 'atividade',
      data_vencimento: dataCampoCalendarioIso(dados.data_vencimento),
      times_ids: timesIds,
      responsaveis_ids: mergedResp,
      responsavel_id: responsavelSingular,
      trava: Boolean(dados.trava),
      updated_at: new Date().toISOString(),
    })
    .eq('id', atividadeId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/sirene/chamados');
  revalidatePath('/');
  return { ok: true };
}

export type ComentarioCardSireneRow = {
  id: string;
  texto: string;
  created_at: string;
  autor_nome: string | null;
};

export async function listarComentariosCardSirene(
  cardId: string,
): Promise<{ ok: true; items: ComentarioCardSireneRow[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cid = String(cardId ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const { data: rows, error } = await supabase
    .from('kanban_card_comentarios')
    .select('id, conteudo, created_at, autor_id')
    .eq('card_id', cid)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) return { ok: false, error: error.message };

  const autorIds = [...new Set((rows ?? []).map((r) => r.autor_id).filter(Boolean))] as string[];
  let nomes = new Map<string, string>();
  if (autorIds.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', autorIds);
    nomes = new Map(
      (profs ?? []).map((p) => [
        String((p as { id: string }).id),
        String((p as { full_name?: string | null }).full_name ?? '').trim() || '—',
      ]),
    );
  }

  const items: ComentarioCardSireneRow[] = (rows ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    texto: htmlComentarioParaTextoPlano(String((r as { conteudo?: string }).conteudo ?? '')),
    created_at: String((r as { created_at?: string }).created_at ?? ''),
    autor_nome: r.autor_id ? nomes.get(String(r.autor_id)) ?? null : null,
  }));

  return { ok: true, items };
}

export async function publicarComentarioCardSirene(
  cardId: string,
  conteudo: string,
  opcoes?: {
    referenciaPath?: string;
    contextoTitulo?: string;
  },
): Promise<AtualizarStatusInteracaoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cid = String(cardId ?? '').trim();
  const raw = String(conteudo ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };
  if (!raw) return { ok: false, error: 'Digite o comentário.' };

  const { plain, mencoesIds } = await resolverMencoesSirene(raw);
  if (!plain) return { ok: false, error: 'Digite o comentário.' };

  const { error } = await supabase.from('kanban_card_comentarios').insert({
    card_id: cid,
    autor_id: user.id,
    conteudo: conteudoPersistivelComentario(raw, plain),
  });

  if (error) return { ok: false, error: error.message };

  await notificarMencoesSirene({
    mencoesIds,
    plain,
    referenciaPath: opcoes?.referenciaPath?.trim() || '/sirene/chamados',
    contextoTitulo: opcoes?.contextoTitulo?.trim() || 'Comentário no card',
    autorId: user.id,
  });

  revalidatePath('/sirene/chamados');
  revalidatePath('/');
  return { ok: true };
}

export async function listarComentariosSireneChamado(
  sireneChamadoId: number,
): Promise<{ ok: true; items: ComentarioCardSireneRow[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: rows, error } = await supabase
    .from('kanban_card_comentarios')
    .select('id, conteudo, created_at, autor_id')
    .eq('sirene_chamado_id', sireneChamadoId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) return { ok: false, error: error.message };

  const autorIds = [...new Set((rows ?? []).map((r) => r.autor_id).filter(Boolean))] as string[];
  let nomes = new Map<string, string>();
  if (autorIds.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', autorIds);
    nomes = new Map(
      (profs ?? []).map((p) => [
        String((p as { id: string }).id),
        String((p as { full_name?: string | null }).full_name ?? '').trim() || '—',
      ]),
    );
  }

  const items: ComentarioCardSireneRow[] = (rows ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    texto: htmlComentarioParaTextoPlano(String((r as { conteudo?: string }).conteudo ?? '')),
    created_at: String((r as { created_at?: string }).created_at ?? ''),
    autor_nome: r.autor_id ? nomes.get(String(r.autor_id)) ?? null : null,
  }));

  return { ok: true, items };
}

export async function publicarComentarioSireneChamado(
  sireneChamadoId: number,
  conteudo: string,
  opcoes?: {
    referenciaPath?: string;
    contextoTitulo?: string;
  },
): Promise<AtualizarStatusInteracaoResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const raw = String(conteudo ?? '').trim();
  if (!raw) return { ok: false, error: 'Digite o comentário.' };

  const { plain, mencoesIds } = await resolverMencoesSirene(raw);
  if (!plain) return { ok: false, error: 'Digite o comentário.' };

  const { error } = await supabase.from('kanban_card_comentarios').insert({
    sirene_chamado_id: sireneChamadoId,
    autor_id: user.id,
    conteudo: conteudoPersistivelComentario(raw, plain),
  });

  if (error) return { ok: false, error: error.message };

  await notificarMencoesSirene({
    mencoesIds,
    plain,
    referenciaPath: opcoes?.referenciaPath?.trim() || `/sirene/chamados?interacao=`,
    contextoTitulo: opcoes?.contextoTitulo?.trim() || 'Comentário no chamado',
    autorId: user.id,
  });

  revalidatePath('/sirene/chamados');
  revalidatePath('/');
  return { ok: true };
}
