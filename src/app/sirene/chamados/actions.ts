'use server';

import { revalidatePath } from 'next/cache';
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

  const concluida_em = status === 'concluida' ? new Date().toISOString() : null;

  const { error } = await admin
    .from('kanban_atividades')
    .update({
      status,
      concluida_em,
      updated_at: new Date().toISOString(),
    })
    .eq('id', atividadeId);

  if (error) return { ok: false, error: error.message };

  const sireneCid = (row as { sirene_chamado_id?: number | null }).sirene_chamado_id;
  if (sireneCid != null && Number.isFinite(Number(sireneCid))) {
    const scStatus =
      status === 'concluida'
        ? 'concluido'
        : status === 'em_andamento'
          ? 'em_andamento'
          : 'nao_iniciado';
    const scPatch: Record<string, unknown> = {
      status: scStatus,
      updated_at: new Date().toISOString(),
    };
    if (status === 'concluida') {
      scPatch.data_conclusao = new Date().toISOString();
    }
    await admin.from('sirene_chamados').update(scPatch).eq('id', Number(sireneCid));
  }

  revalidatePath('/sirene/chamados');
  revalidatePath('/');
  return { ok: true };
}

export type AtualizarInteracaoCompletaSireneInput = {
  titulo: string;
  tipo: 'atividade' | 'duvida';
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
      tipo: dados.tipo === 'duvida' ? 'duvida' : 'atividade',
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
    .select('id, texto, created_at, autor_id')
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
    texto: String((r as { texto?: string }).texto ?? ''),
    created_at: String((r as { created_at?: string }).created_at ?? ''),
    autor_nome: r.autor_id ? nomes.get(String(r.autor_id)) ?? null : null,
  }));

  return { ok: true, items };
}

export async function publicarComentarioCardSirene(
  cardId: string,
  texto: string,
  faseId?: string | null,
): Promise<AtualizarStatusInteracaoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cid = String(cardId ?? '').trim();
  const t = String(texto ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };
  if (!t) return { ok: false, error: 'Digite o comentário.' };

  const { error } = await supabase.from('kanban_card_comentarios').insert({
    card_id: cid,
    fase_id: faseId?.trim() || null,
    autor_id: user.id,
    texto: t,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/sirene/chamados');
  revalidatePath('/');
  return { ok: true };
}
