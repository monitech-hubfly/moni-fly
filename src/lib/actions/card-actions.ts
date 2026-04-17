'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * `data_vencimento` / `data_fim` vindos de `<input type="date">`: grava só `YYYY-MM-DD`,
 * sem `new Date()` / `toISOString()` (evita perder um dia em timezones atrás do UTC).
 */
function dataCampoCalendarioIso(input: string | null | undefined): string | null {
  const t = String(input ?? '').trim();
  if (!t) return null;
  const head = t.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

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
  titulo?: string;
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
    data_vencimento: dataCampoCalendarioIso(input.data_vencimento),
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

  /** `data_vencimento` usa só `dataCampoCalendarioIso`; `updated_at` é timestamp de auditoria (não campo date HTML). */
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (dados.titulo !== undefined) {
    const t = String(dados.titulo ?? '').trim();
    if (!t) return { ok: false, error: 'O título do chamado não pode ficar vazio.' };
    update.titulo = t;
  }
  if (dados.descricao !== undefined) update.descricao = dados.descricao;
  if (dados.tipo !== undefined) update.tipo = dados.tipo === 'duvida' ? 'duvida' : 'atividade';
  if (dados.data_vencimento !== undefined) {
    update.data_vencimento = dataCampoCalendarioIso(dados.data_vencimento);
  }
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
    data_fim: dataCampoCalendarioIso(input.data_fim),
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

export type ArquivarCardInput = {
  cardId: string;
  motivo: string;
  basePath?: string;
};

export async function finalizarCard(input: {
  cardId: string;
  basePath?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para finalizar o card.' };

  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const { data: row, error: fetchErr } = await supabase
    .from('kanban_cards')
    .select('id, kanban_id, fase_id, concluido, arquivado')
    .eq('id', cardId)
    .maybeSingle();

  if (fetchErr || !row) return { ok: false, error: fetchErr?.message ?? 'Card não encontrado.' };

  const r = row as { kanban_id: string; fase_id: string; concluido?: boolean | null; arquivado?: boolean | null };
  if (Boolean(r.concluido)) return { ok: false, error: 'Este card já está concluído.' };
  if (Boolean(r.arquivado)) return { ok: false, error: 'Não é possível finalizar um card arquivado.' };

  const kid = String(r.kanban_id ?? '').trim();
  const fid = String(r.fase_id ?? '').trim();
  if (!kid || !fid) return { ok: false, error: 'Dados do card incompletos.' };

  const { data: ultimaFase, error: faseErr } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', kid)
    .eq('ativo', true)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (faseErr || !ultimaFase) return { ok: false, error: faseErr?.message ?? 'Não foi possível obter a última fase do kanban.' };

  const ultimaId = String((ultimaFase as { id: string }).id);
  if (fid !== ultimaId) {
    return { ok: false, error: 'O card precisa estar na última fase do funil para ser finalizado.' };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('kanban_cards')
    .update({
      concluido: true,
      concluido_em: now,
      concluido_por: user.id,
    } as never)
    .eq('id', cardId);

  if (error) return { ok: false, error: error.message };

  const bp = input.basePath?.trim() || '/';
  revalidatePath(bp);
  revalidatePath('/');
  return { ok: true };
}

export async function arquivarCard(input: ArquivarCardInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para arquivar o card.' };

  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const motivo = String(input.motivo ?? '').trim();
  if (!motivo) return { ok: false, error: 'Informe o motivo do arquivamento.' };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('kanban_cards')
    .update({
      arquivado: true,
      arquivado_em: now,
      arquivado_por: user.id,
      motivo_arquivamento: motivo,
    } as never)
    .eq('id', cardId);

  if (error) return { ok: false, error: error.message };

  const bp = input.basePath?.trim() || '/';
  revalidatePath(bp);
  revalidatePath('/');
  return { ok: true };
}

export type DesarquivarCardInput = {
  cardId: string;
  basePath?: string;
};

export async function desarquivarCard(input: DesarquivarCardInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para desarquivar o card.' };

  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const { error } = await supabase
    .from('kanban_cards')
    .update({
      arquivado: false,
      arquivado_em: null,
      arquivado_por: null,
      motivo_arquivamento: null,
    } as never)
    .eq('id', cardId);

  if (error) return { ok: false, error: error.message };

  const bp = input.basePath?.trim() || '/';
  revalidatePath(bp);
  revalidatePath('/');
  return { ok: true };
}

export type CardArquivadoListRow = {
  id: string;
  titulo: string;
  fase_nome: string | null;
  arquivado_em: string | null;
  motivo_arquivamento: string | null;
};

export type ListarArquivadosResult =
  | { ok: true; items: CardArquivadoListRow[] }
  | { ok: false; error: string };

export async function listarArquivados(kanbanId: string): Promise<ListarArquivadosResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para listar arquivados.' };

  const kid = String(kanbanId ?? '').trim();
  if (!kid) return { ok: false, error: 'Kanban inválido.' };

  const { data: rows, error } = await supabase
    .from('kanban_cards')
    .select('id, titulo, fase_id, arquivado_em, motivo_arquivamento')
    .eq('kanban_id', kid)
    .eq('arquivado', true)
    .order('arquivado_em', { ascending: false });

  if (error) return { ok: false, error: error.message };

  const list = rows ?? [];
  const faseIds = [...new Set(list.map((r) => String((r as { fase_id?: string }).fase_id ?? '')).filter(Boolean))];
  const faseNomeById = new Map<string, string>();
  if (faseIds.length > 0) {
    const { data: fases } = await supabase.from('kanban_fases').select('id, nome').in('id', faseIds);
    fases?.forEach((f) => {
      const id = String((f as { id: string }).id);
      const nome = (f as { nome?: string | null }).nome;
      faseNomeById.set(id, nome?.trim() ? String(nome) : '—');
    });
  }

  const items: CardArquivadoListRow[] = list.map((r) => {
    const row = r as {
      id: string;
      titulo: string | null;
      fase_id: string | null;
      arquivado_em: string | null;
      motivo_arquivamento: string | null;
    };
    const fid = row.fase_id ? String(row.fase_id) : '';
    return {
      id: String(row.id),
      titulo: (row.titulo ?? '').trim() || '(sem título)',
      fase_nome: fid ? (faseNomeById.get(fid) ?? '—') : '—',
      arquivado_em: row.arquivado_em,
      motivo_arquivamento: row.motivo_arquivamento,
    };
  });

  return { ok: true, items };
}

export type SalvarDadosPreObraInput = {
  processoId: string;
  previsao_aprovacao_condominio?: string | null;
  previsao_aprovacao_prefeitura?: string | null;
  previsao_emissao_alvara?: string | null;
  previsao_liberacao_credito_obra?: string | null;
  previsao_inicio_obra?: string | null;
  data_aprovacao_condominio?: string | null;
  data_aprovacao_prefeitura?: string | null;
  data_emissao_alvara?: string | null;
  data_aprovacao_credito?: string | null;
  basePath?: string;
};

export async function salvarDadosPreObra(input: SalvarDadosPreObraInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para salvar.' };

  const pid = String(input.processoId ?? '').trim();
  if (!pid) return { ok: false, error: 'Processo inválido.' };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const setText = (k: keyof SalvarDadosPreObraInput, col: string) => {
    const v = input[k];
    if (v !== undefined) update[col] = String(v ?? '').trim() || null;
  };

  setText('previsao_aprovacao_condominio', 'previsao_aprovacao_condominio');
  setText('previsao_aprovacao_prefeitura', 'previsao_aprovacao_prefeitura');
  setText('previsao_emissao_alvara', 'previsao_emissao_alvara');
  setText('previsao_liberacao_credito_obra', 'previsao_liberacao_credito_obra');
  setText('previsao_inicio_obra', 'previsao_inicio_obra');

  const setDate = (k: keyof SalvarDadosPreObraInput, col: string) => {
    const v = input[k];
    if (v !== undefined) update[col] = dataCampoCalendarioIso(String(v ?? ''));
  };
  setDate('data_aprovacao_condominio', 'data_aprovacao_condominio');
  setDate('data_aprovacao_prefeitura', 'data_aprovacao_prefeitura');
  setDate('data_emissao_alvara', 'data_emissao_alvara');
  setDate('data_aprovacao_credito', 'data_aprovacao_credito');

  const { error } = await supabase.from('processo_step_one').update(update as never).eq('id', pid);
  if (error) return { ok: false, error: error.message };

  revalidatePath(input.basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

export type UploadContratoFranquiaResult = ActionResult & { path?: string };

/** Upload de contrato para `contratos-franquia` e grava `contrato_franquia_path` em `rede_franqueados`. */
export async function uploadContratoFranquia(formData: FormData): Promise<UploadContratoFranquiaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para anexar.' };

  const franqueadoId = String(formData.get('franqueadoId') ?? '').trim();
  if (!franqueadoId) return { ok: false, error: 'Franqueado inválido.' };

  const file = formData.get('file');
  if (!file || !(file instanceof File) || file.size === 0) return { ok: false, error: 'Selecione um arquivo.' };

  const safeName = file.name.replace(/[^\w.\-()+ ]/g, '_').slice(0, 180);
  const path = `${franqueadoId}/${Date.now()}_${safeName}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage.from('contratos-franquia').upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: true,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { error: dbErr } = await supabase
    .from('rede_franqueados')
    .update({ contrato_franquia_path: path } as never)
    .eq('id', franqueadoId);
  if (dbErr) return { ok: false, error: dbErr.message };

  revalidatePath(String(formData.get('basePath') ?? '').trim() || '/');
  revalidatePath('/');
  return { ok: true, path };
}
