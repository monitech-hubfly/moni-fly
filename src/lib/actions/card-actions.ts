'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type CriarInteracaoInput = {
  card_id: string;
  titulo: string;
  tipo: 'atividade' | 'duvida';
  times_ids: string[];
  data_vencimento: string | null;
  /** Legado: um responsável; preferir `responsaveis_ids`. */
  responsavel_id?: string | null;
  /** Novos campos (migration 117). */
  responsaveis_ids?: string[];
  trava?: boolean;
  status?: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  ordem: number;
  /** Rota do kanban (ex.: `/portfolio`) para invalidar cache após mutação. */
  basePath?: string;
  /** `legado` quando `card_id` é `processo_step_one.id` (migration 116). */
  origem?: 'nativo' | 'legado';
};

export type EditarInteracaoInput = {
  descricao?: string | null;
  tipo?: 'atividade' | 'duvida';
  data_vencimento?: string | null;
  times_ids?: string[];
  responsavel_id?: string | null;
  responsaveis_ids?: string[];
  trava?: boolean;
  /** Rota do kanban para `revalidatePath`. */
  basePath?: string;
};

export type CriarSubInteracaoInput = {
  interacao_id: string;
  descricao: string;
  times_ids: string[];
  responsaveis_ids: string[];
  data_fim?: string | null;
  trava: boolean;
  basePath?: string;
};

export type SubInteracaoStatusDb = 'nao_iniciado' | 'em_andamento' | 'concluido' | 'aprovado';

export type ActionOk = { ok: true };
export type ActionErr = { ok: false; error: string };
export type ActionResult = ActionOk | ActionErr;

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

export async function criarInteracao(input: CriarInteracaoInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para criar um chamado.' };

  const timesIds = uniqUuids(input.times_ids);
  const respIds = uniqUuids(input.responsaveis_ids);
  const legacyResp = input.responsavel_id?.trim() || null;
  const mergedResp =
    respIds.length > 0 ? respIds : legacyResp ? [legacyResp] : [];
  const responsavelSingular = mergedResp.length > 0 ? mergedResp[0]! : null;

  const titulo = (input.titulo ?? '').trim();
  if (!titulo) return { ok: false, error: 'Informe o título do chamado.' };

  const row = {
    card_id: input.card_id,
    titulo,
    tipo: input.tipo === 'duvida' ? 'duvida' : 'atividade',
    times_ids: timesIds,
    data_vencimento: input.data_vencimento?.trim() || null,
    responsavel_id: responsavelSingular,
    responsaveis_ids: mergedResp,
    trava: Boolean(input.trava),
    status: input.status ?? 'pendente',
    prioridade: 'normal',
    ordem: input.ordem,
    criado_por: user.id,
    time: null,
    origem: input.origem === 'legado' ? 'legado' : 'nativo',
  };

  const { error } = await supabase.from('kanban_atividades').insert(row as never);
  if (error) return { ok: false, error: error.message };

  revalidatePath(input.basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

export async function editarInteracao(id: string, dados: EditarInteracaoInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para editar.' };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (dados.descricao !== undefined) update.descricao = dados.descricao;
  if (dados.tipo !== undefined) update.tipo = dados.tipo === 'duvida' ? 'duvida' : 'atividade';
  if (dados.data_vencimento !== undefined) update.data_vencimento = dados.data_vencimento?.trim() || null;
  if (dados.times_ids !== undefined) update.times_ids = uniqUuids(dados.times_ids);
  if (dados.trava !== undefined) update.trava = Boolean(dados.trava);

  if (dados.responsaveis_ids !== undefined) {
    const merged = uniqUuids(dados.responsaveis_ids);
    update.responsaveis_ids = merged;
    update.responsavel_id = merged.length > 0 ? merged[0]! : null;
  } else if (dados.responsavel_id !== undefined) {
    const r = dados.responsavel_id?.trim() || null;
    update.responsavel_id = r;
    update.responsaveis_ids = r ? [r] : [];
  }

  const { error } = await supabase.from('kanban_atividades').update(update as never).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(dados.basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

async function labelTimeResponsavel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  times_ids: string[],
): Promise<string> {
  if (!times_ids.length) return '—';
  const { data } = await supabase.from('kanban_times').select('nome').eq('id', times_ids[0]!).maybeSingle();
  const n = (data as { nome?: string } | null)?.nome?.trim();
  return n && n.length > 0 ? n : '—';
}

export async function criarSubInteracao(input: CriarSubInteracaoInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para criar um sub-chamado.' };

  const desc = (input.descricao ?? '').trim();
  if (!desc) return { ok: false, error: 'Informe o título do sub-chamado.' };

  const timesIds = uniqUuids(input.times_ids);
  const respIds = uniqUuids(input.responsaveis_ids);
  const timeLabel = await labelTimeResponsavel(supabase, timesIds);

  const { data: maxRow } = await supabase
    .from('sirene_topicos')
    .select('ordem')
    .eq('interacao_id', input.interacao_id)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();
  const proxOrdem = ((maxRow as { ordem?: number } | null)?.ordem ?? 0) + 1;

  const row = {
    chamado_id: null,
    interacao_id: input.interacao_id,
    ordem: proxOrdem,
    descricao: desc,
    time_responsavel: timeLabel,
    responsavel_id: respIds.length > 0 ? respIds[0]! : null,
    responsaveis_ids: respIds,
    times_ids: timesIds,
    trava: Boolean(input.trava),
    data_fim: input.data_fim?.trim() || null,
    data_inicio: null,
    status: 'nao_iniciado' as const,
  };

  const { error } = await supabase.from('sirene_topicos').insert(row as never);
  if (error) return { ok: false, error: error.message };

  revalidatePath(input.basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

export async function atualizarStatusSubInteracao(
  id: number | string,
  status: SubInteracaoStatusDb,
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para atualizar.' };

  const idNum = typeof id === 'number' ? id : Number.parseInt(String(id), 10);
  if (!Number.isFinite(idNum)) return { ok: false, error: 'ID inválido.' };

  const { error } = await supabase
    .from('sirene_topicos')
    .update({ status, updated_at: new Date().toISOString() } as never)
    .eq('id', idNum);

  if (error) return { ok: false, error: error.message };

  revalidatePath(basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}
