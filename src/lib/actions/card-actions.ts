'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { KanbanFaseMaterial } from '@/components/kanban-shared/types';
import { KANBAN_APP_BASE_PATHS } from '@/lib/kanban/kanban-card-href';
import { parseKanbanFaseMateriais } from '@/lib/kanban/parse-kanban-fase-materiais';
import { criarChamado } from '@/app/sirene/actions';
import type { SubInteracaoTipoDb } from '@/types/kanban-subinteracao';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { FaseChecklistItem } from './candidato-actions';

export type { FaseChecklistItem } from './candidato-actions';

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
  tipo: 'atividade' | 'duvida' | 'chamado_padrao' | 'chamado_hdm';
  times_ids: string[];
  data_vencimento: string | null;
  /** Legado: um responsável; preferir `responsaveis_ids`. */
  responsavel_id?: string | null;
  /** Novos campos (migration 117). */
  responsaveis_ids?: string[];
  /** Nome em texto quando não há perfil (catálogo Moní). */
  responsavel_nome_texto?: string | null;
  /** Coluna `time` (texto) quando não há UUID em `kanban_times`. */
  time_legado?: string | null;
  trava?: boolean;
  status?: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  ordem: number;
  /** Rota do kanban (ex.: `/portfolio`) para invalidar cache após mutação. */
  basePath?: string;
  /** `legado` quando `card_id` é `processo_step_one.id` (migration 116). */
  origem?: 'nativo' | 'legado';
  tema: string;
};

export type EditarInteracaoInput = {
  titulo?: string;
  descricao?: string | null;
  tipo?: 'atividade' | 'duvida';
  data_vencimento?: string | null;
  times_ids?: string[];
  responsavel_id?: string | null;
  responsaveis_ids?: string[];
  responsavel_nome_texto?: string | null;
  time_legado?: string | null;
  trava?: boolean;
  /** Rota do kanban para `revalidatePath`. */
  basePath?: string;
};

export type { SubInteracaoTipoDb } from '@/types/kanban-subinteracao';

export type CriarSubInteracaoInput = {
  interacao_id: string;
  descricao: string;
  /** Categoria do sub-chamado (`sirene_topicos.tipo`, migration 165). */
  tipo?: SubInteracaoTipoDb;
  times_ids: string[];
  responsaveis_ids: string[];
  data_fim?: string | null;
  trava: boolean;
  basePath?: string;
  tema: string;
};

export type SubInteracaoStatusDb = 'nao_iniciado' | 'em_andamento' | 'concluido' | 'aprovado';

export type ActionOk = { ok: true };
export type ActionErr = { ok: false; error: string };
export type ActionResult = ActionOk | ActionErr;

async function fetchCardMetaForSireneChamado(
  admin: ReturnType<typeof createAdminClient>,
  cardId: string,
  origem: 'nativo' | 'legado',
): Promise<{ titulo: string; kanban_nome: string } | null> {
  if (origem === 'legado') {
    const { data: v, error } = await admin
      .from('v_processo_como_kanban_cards')
      .select('titulo, kanban_id')
      .eq('id', cardId)
      .maybeSingle();
    if (error || !v) return null;
    const kid = String((v as { kanban_id?: string }).kanban_id ?? '');
    const { data: kb } = await admin.from('kanbans').select('nome').eq('id', kid).maybeSingle();
    return {
      titulo: String((v as { titulo?: string | null }).titulo ?? 'Sem título'),
      kanban_nome: String((kb as { nome?: string } | null)?.nome ?? 'Funil Step One'),
    };
  }
  const { data: card, error: cErr } = await admin
    .from('kanban_cards')
    .select('titulo, kanban_id')
    .eq('id', cardId)
    .maybeSingle();
  if (cErr || !card) return null;
  const kid = String((card as { kanban_id?: string }).kanban_id ?? '');
  const { data: kb2 } = await admin.from('kanbans').select('nome').eq('id', kid).maybeSingle();
  return {
    titulo: String((card as { titulo?: string | null }).titulo ?? 'Sem título'),
    kanban_nome: String((kb2 as { nome?: string } | null)?.nome ?? '—'),
  };
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
  const nomeTxtRaw = (input.responsavel_nome_texto ?? '').trim() || null;
  const responsavel_nome_texto = mergedResp.length > 0 ? null : nomeTxtRaw;
  const timeLegado = (input.time_legado ?? '').trim() || null;
  const timeCol = timesIds.length > 0 ? null : timeLegado;

  const titulo = (input.titulo ?? '').trim();
  if (!titulo) return { ok: false, error: 'Informe o título do chamado.' };

  if (input.tipo === 'chamado_padrao' || input.tipo === 'chamado_hdm') {
    const admin = createAdminClient();
    const meta = await fetchCardMetaForSireneChamado(admin, input.card_id, input.origem ?? 'nativo');
    if (!meta) return { ok: false, error: 'Não foi possível resolver o card para criar o chamado Sirene.' };
    const fd = new FormData();
    fd.set('incendio', titulo);
    fd.set('te_trata', 'nao');
    fd.set('tipo', input.tipo === 'chamado_hdm' ? 'hdm' : 'padrao');
    fd.set('card_id', input.card_id);
    fd.set('card_kanban_nome', meta.kanban_nome);
    fd.set('card_titulo', meta.titulo);
    if (input.data_vencimento) fd.set('data_vencimento', input.data_vencimento);
    const cr = await criarChamado(fd);
    if (!cr.ok) return { ok: false, error: cr.error };
  }

  const resolvedTipo: 'atividade' | 'duvida' | 'chamado_padrao' | 'chamado_hdm' =
    input.tipo === 'chamado_padrao'
      ? 'chamado_padrao'
      : input.tipo === 'chamado_hdm'
        ? 'chamado_hdm'
        : input.tipo === 'duvida'
          ? 'duvida'
          : 'atividade';

  const row = {
    card_id: input.card_id,
    titulo,
    tipo: resolvedTipo,
    times_ids: timesIds,
    data_vencimento: dataCampoCalendarioIso(input.data_vencimento),
    responsavel_id: responsavelSingular,
    responsaveis_ids: mergedResp,
    responsavel_nome_texto,
    trava: Boolean(input.trava),
    status: input.status ?? 'pendente',
    prioridade: 'normal',
    ordem: input.ordem,
    criado_por: user.id,
    time: timeCol,
    origem: input.origem === 'legado' ? 'legado' : 'nativo',
    tema: input.tema,
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
  if (dados.time_legado !== undefined) {
    update.time = dados.time_legado?.trim() || null;
  }
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
  if (dados.responsavel_nome_texto !== undefined) {
    const nt = (dados.responsavel_nome_texto ?? '').trim() || null;
    update.responsavel_nome_texto = nt;
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

  const tipoSub: SubInteracaoTipoDb =
    input.tipo === 'duvida' || input.tipo === 'chamado' ? input.tipo : 'atividade';

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
    tipo: tipoSub,
    tema: input.tema,
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

export type CriarCardKanbanInput = {
  titulo: string;
  kanban_nome: string;
  fase_id: string;
  /** Ex.: `/funil-moni-inc` para `revalidatePath`. */
  basePath?: string;
};

/** Card nativo no kanban (`franqueado_id` = utilizador autenticado). */
export async function criarCard(input: CriarCardKanbanInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para criar o card.' };

  const titulo = (input.titulo ?? '').trim();
  if (!titulo) return { ok: false, error: 'Informe o nome.' };

  const kanbanNome = (input.kanban_nome ?? '').trim();
  if (!kanbanNome) return { ok: false, error: 'Kanban inválido.' };

  const faseId = (input.fase_id ?? '').trim();
  if (!faseId) return { ok: false, error: 'Fase inválida.' };

  const { data: kb, error: kbErr } = await supabase
    .from('kanbans')
    .select('id')
    .eq('nome', kanbanNome)
    .eq('ativo', true)
    .maybeSingle();
  if (kbErr) return { ok: false, error: kbErr.message };
  const kanbanId = String((kb as { id?: string } | null)?.id ?? '').trim();
  if (!kanbanId) return { ok: false, error: 'Kanban não encontrado.' };

  const { data: faseRow, error: faseErr } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('id', faseId)
    .eq('kanban_id', kanbanId)
    .eq('ativo', true)
    .maybeSingle();
  if (faseErr) return { ok: false, error: faseErr.message };
  if (!faseRow) return { ok: false, error: 'Fase não pertence a este kanban.' };

  const { error } = await supabase.from('kanban_cards').insert({
    kanban_id: kanbanId,
    fase_id: faseId,
    franqueado_id: user.id,
    titulo,
    status: 'ativo',
  } as never);
  if (error) return { ok: false, error: error.message };

  const bp = (input.basePath ?? '').trim() || '/';
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

/** Atualiza texto e materiais da fase (admin/consultor). */
export async function salvarInstrucoesFase(
  faseId: string,
  instrucoes: string | null,
  materiais: KanbanFaseMaterial[],
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para salvar.' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = String((profile as { role?: string } | null)?.role ?? '');
  if (role !== 'admin' && role !== 'consultor') {
    return { ok: false, error: 'Apenas administradores e consultores podem editar instruções da fase.' };
  }

  const fid = String(faseId ?? '').trim();
  if (!fid) return { ok: false, error: 'Fase inválida.' };

  const lista = parseKanbanFaseMateriais(materiais);
  const inst =
    instrucoes != null && String(instrucoes).trim() !== '' ? String(instrucoes).trim() : null;

  const { error } = await supabase
    .from('kanban_fases')
    .update({ instrucoes: inst, materiais: lista as unknown as never })
    .eq('id', fid);

  if (error) return { ok: false, error: error.message };

  revalidatePath(basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

export type TipoVinculoKanbanCard = 'relacionado' | 'depende_de' | 'bloqueia';

export type KanbanCardVinculoListItem = {
  id: string;
  tipo_vinculo: TipoVinculoKanbanCard;
  /** Card atual é a origem do registro (seta saindo) ou o destino (seta entrando). */
  papel: 'origem' | 'destino';
  outro_card: { id: string; titulo: string; kanban_nome: string };
};

async function perfilEhAdminOuConsultor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
  const role = String((profile as { role?: string } | null)?.role ?? '');
  return role === 'admin' || role === 'consultor';
}

async function perfilEhAdminOuTeam(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
  const role = String((profile as { role?: string } | null)?.role ?? '').toLowerCase();
  return role === 'admin' || role === 'team';
}

function kanbanNomeDeJoin(row: { kanbans?: unknown }): string {
  const kn = row.kanbans;
  if (Array.isArray(kn)) return String((kn[0] as { nome?: string } | undefined)?.nome ?? '').trim();
  if (kn && typeof kn === 'object') return String((kn as { nome?: string }).nome ?? '').trim();
  return '';
}

/** Lista vínculos em que o card participa (origem ou destino). */
export async function listarVinculosCard(
  cardId: string,
): Promise<{ ok: true; items: KanbanCardVinculoListItem[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cid = String(cardId ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const { data: vins, error } = await supabase
    .from('kanban_card_vinculos')
    .select('id, tipo_vinculo, card_origem_id, card_destino_id')
    .or(`card_origem_id.eq.${cid},card_destino_id.eq.${cid}`);

  if (error) return { ok: false, error: error.message };
  const rows = (vins ?? []) as {
    id: string;
    tipo_vinculo: string;
    card_origem_id: string;
    card_destino_id: string;
  }[];
  if (rows.length === 0) return { ok: true, items: [] };

  const idSet = new Set<string>();
  for (const v of rows) {
    idSet.add(String(v.card_origem_id));
    idSet.add(String(v.card_destino_id));
  }
  const idList = [...idSet];

  const { data: cards, error: cErr } = await supabase
    .from('kanban_cards')
    .select('id, titulo, kanban_id, kanbans(nome)')
    .in('id', idList);
  if (cErr) return { ok: false, error: cErr.message };

  const mapInfo = new Map<string, { titulo: string; kanban_nome: string }>();
  for (const c of cards ?? []) {
    const row = c as { id: string; titulo: string | null; kanbans?: unknown };
    const nomeKanban = kanbanNomeDeJoin(row);
    mapInfo.set(String(row.id), {
      titulo: (row.titulo ?? '').trim() || '(sem título)',
      kanban_nome: nomeKanban || 'Kanban',
    });
  }

  const items: KanbanCardVinculoListItem[] = rows.map((v) => {
    const papel: 'origem' | 'destino' = v.card_origem_id === cid ? 'origem' : 'destino';
    const outroId = v.card_origem_id === cid ? v.card_destino_id : v.card_origem_id;
    const info = mapInfo.get(outroId) ?? { titulo: '—', kanban_nome: '—' };
    const tv = String(v.tipo_vinculo ?? 'relacionado');
    const tipo: TipoVinculoKanbanCard =
      tv === 'depende_de' || tv === 'bloqueia' || tv === 'relacionado' ? tv : 'relacionado';
    return {
      id: v.id,
      tipo_vinculo: tipo,
      papel,
      outro_card: { id: outroId, titulo: info.titulo, kanban_nome: info.kanban_nome },
    };
  });

  return { ok: true, items };
}

export type BuscaCardVinculoRow = { id: string; titulo: string; kanban_nome: string };

/** Busca cards por título (admin/consultor) para vincular. */
export async function buscarCardsParaVinculo(
  termo: string,
  excetoCardId: string,
): Promise<{ ok: true; items: BuscaCardVinculoRow[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const pode = await perfilEhAdminOuConsultor(supabase, user.id);
  if (!pode) return { ok: false, error: 'Sem permissão para buscar cards.' };

  const t = String(termo ?? '').trim().replace(/%/g, '').replace(/_/g, ' ').slice(0, 120);
  if (t.length < 2) return { ok: true, items: [] };

  const ex = String(excetoCardId ?? '').trim();
  let q = supabase
    .from('kanban_cards')
    .select('id, titulo, kanbans(nome)')
    .ilike('titulo', `%${t}%`)
    .limit(25);
  if (ex) q = q.neq('id', ex);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };

  const items: BuscaCardVinculoRow[] = (data ?? []).map((row) => {
    const r = row as { id: string; titulo: string | null; kanbans?: unknown };
    return {
      id: String(r.id),
      titulo: (r.titulo ?? '').trim() || '(sem título)',
      kanban_nome: kanbanNomeDeJoin(r) || 'Kanban',
    };
  });
  return { ok: true, items };
}

export async function criarVinculoCard(input: {
  cardOrigemId: string;
  cardDestinoId: string;
  tipo: TipoVinculoKanbanCard;
  basePath?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const pode = await perfilEhAdminOuConsultor(supabase, user.id);
  if (!pode) return { ok: false, error: 'Sem permissão para criar vínculo.' };

  const orig = String(input.cardOrigemId ?? '').trim();
  const dest = String(input.cardDestinoId ?? '').trim();
  if (!orig || !dest || orig === dest) return { ok: false, error: 'Cards inválidos.' };

  const tipo =
    input.tipo === 'depende_de' || input.tipo === 'bloqueia' || input.tipo === 'relacionado'
      ? input.tipo
      : 'relacionado';

  const { error } = await supabase.from('kanban_card_vinculos').insert({
    card_origem_id: orig,
    card_destino_id: dest,
    tipo_vinculo: tipo,
    criado_por: user.id,
  } as never);

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Este vínculo já existe.' };
    return { ok: false, error: error.message };
  }

  revalidatePath(input.basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

export async function removerVinculoCard(
  vinculoId: string,
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const pode = await perfilEhAdminOuConsultor(supabase, user.id);
  if (!pode) return { ok: false, error: 'Sem permissão para remover vínculo.' };

  const vid = String(vinculoId ?? '').trim();
  if (!vid) return { ok: false, error: 'Vínculo inválido.' };

  const { error } = await supabase.from('kanban_card_vinculos').delete().eq('id', vid);
  if (error) return { ok: false, error: error.message };

  revalidatePath(basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

const MAX_ANEXO_BYTES = 10 * 1024 * 1024;

export type ChamadoAnexoRow = {
  id: string;
  chamado_id: string;
  storage_path: string;
  nome_original: string;
  tamanho: number | null;
  tipo_mime: string | null;
  uploader_id: string | null;
  uploader_nome: string | null;
  criado_em: string;
};

export type SubchamadoAnexoRow = {
  id: string;
  subchamado_id: string;
  storage_path: string;
  nome_original: string;
  tamanho: number | null;
  tipo_mime: string | null;
  uploader_id: string | null;
  uploader_nome: string | null;
  criado_em: string;
};

function sanitizeNomeArquivo(nome: string): string {
  return String(nome ?? '')
    .replace(/[/\\]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export async function listarAnexosChamado(
  chamadoId: string,
): Promise<{ ok: true; items: ChamadoAnexoRow[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const cid = String(chamadoId ?? '').trim();
  if (!cid) return { ok: false, error: 'Chamado inválido.' };

  const { data, error } = await supabase
    .from('chamado_anexos')
    .select('id, chamado_id, storage_path, nome_original, tamanho, tipo_mime, uploader_id, uploader_nome, criado_em')
    .eq('chamado_id', cid)
    .order('criado_em', { ascending: false });
  if (error) return { ok: false, error: error.message };
  const items = (data ?? []) as unknown as ChamadoAnexoRow[];
  return { ok: true, items };
}

export async function listarAnexosSubchamado(
  subchamadoId: string,
): Promise<{ ok: true; items: SubchamadoAnexoRow[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const sid = Number.parseInt(String(subchamadoId ?? '').trim(), 10);
  if (!Number.isFinite(sid)) return { ok: false, error: 'Sub-chamado inválido.' };

  const { data, error } = await supabase
    .from('subchamado_anexos')
    .select('id, subchamado_id, storage_path, nome_original, tamanho, tipo_mime, uploader_id, uploader_nome, criado_em')
    .eq('subchamado_id', sid)
    .order('criado_em', { ascending: false });
  if (error) return { ok: false, error: error.message };
  const items = (data ?? []).map((r) => {
    const x = r as Record<string, unknown>;
    return {
      id: String(x.id),
      subchamado_id: String(x.subchamado_id),
      storage_path: String(x.storage_path ?? ''),
      nome_original: String(x.nome_original ?? ''),
      tamanho: x.tamanho != null ? Number(x.tamanho) : null,
      tipo_mime: x.tipo_mime != null ? String(x.tipo_mime) : null,
      uploader_id: x.uploader_id != null ? String(x.uploader_id) : null,
      uploader_nome: x.uploader_nome != null ? String(x.uploader_nome) : null,
      criado_em: String(x.criado_em ?? ''),
    } satisfies SubchamadoAnexoRow;
  });
  return { ok: true, items };
}

export async function getSignedUrlAnexo(
  bucket: string,
  path: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const b = String(bucket ?? '').trim();
  const p = String(path ?? '').trim();
  if (!b || !p) return { ok: false, error: 'Bucket ou caminho inválido.' };
  if (b !== 'chamados-attachments' && b !== 'subchamados-attachments') {
    return { ok: false, error: 'Bucket não permitido.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data, error } = await supabase.storage.from(b).createSignedUrl(p, 3600);
  if (error || !data?.signedUrl) return { ok: false, error: error?.message ?? 'Não foi possível gerar o link.' };
  return { ok: true, url: data.signedUrl };
}

export async function adicionarAnexoChamado(
  formData: FormData,
  basePath?: string,
): Promise<ActionResult & { storagePath?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const chamadoId = String(formData.get('chamadoId') ?? '').trim();
  const uploaderNome = String(formData.get('uploaderNome') ?? '').trim() || '—';
  const portalFrank = formData.get('portalFrank') === 'true' || formData.get('portalFrank') === '1';
  const file = formData.get('file');
  if (!chamadoId) return { ok: false, error: 'Chamado inválido.' };
  if (!(file instanceof File)) return { ok: false, error: 'Arquivo inválido.' };
  if (file.size > MAX_ANEXO_BYTES) return { ok: false, error: 'Arquivo acima de 10 MB.' };

  const { data: atv, error: eAtv } = await supabase
    .from('kanban_atividades')
    .select('id, criado_por, responsaveis_ids')
    .eq('id', chamadoId)
    .maybeSingle();
  if (eAtv || !atv) return { ok: false, error: 'Chamado não encontrado.' };
  const row = atv as { criado_por?: string | null; responsaveis_ids?: string[] | null };
  const resp = Array.isArray(row.responsaveis_ids) ? row.responsaveis_ids.map(String) : [];
  const adminTeam = await perfilEhAdminOuTeam(supabase, user.id);
  const ehCriador = row.criado_por != null && String(row.criado_por) === user.id;
  const ehResp = resp.includes(user.id);
  if (portalFrank) {
    if (!adminTeam && !ehCriador) {
      return { ok: false, error: 'No portal do franqueado só é possível anexar em chamados criados por você.' };
    }
  } else if (!adminTeam && !ehCriador && !ehResp) {
    return { ok: false, error: 'Sem permissão para anexar neste chamado.' };
  }

  const orig = sanitizeNomeArquivo(file.name || 'arquivo');
  const storagePath = `chamados/${chamadoId}/${randomUUID()}-${orig}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from('chamados-attachments').upload(storagePath, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { error: insErr } = await supabase.from('chamado_anexos').insert({
    chamado_id: chamadoId,
    storage_path: storagePath,
    nome_original: orig,
    tamanho: file.size,
    tipo_mime: file.type || null,
    uploader_id: user.id,
    uploader_nome: uploaderNome,
  } as never);
  if (insErr) {
    await supabase.storage.from('chamados-attachments').remove([storagePath]);
    return { ok: false, error: insErr.message };
  }

  revalidatePath(basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true, storagePath };
}

export async function adicionarAnexoSubchamado(formData: FormData, basePath?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const subIdRaw = String(formData.get('subchamadoId') ?? '').trim();
  const uploaderNome = String(formData.get('uploaderNome') ?? '').trim() || '—';
  const file = formData.get('file');
  const sid = Number.parseInt(subIdRaw, 10);
  if (!Number.isFinite(sid)) return { ok: false, error: 'Sub-chamado inválido.' };
  if (!(file instanceof File)) return { ok: false, error: 'Arquivo inválido.' };
  if (file.size > MAX_ANEXO_BYTES) return { ok: false, error: 'Arquivo acima de 10 MB.' };

  const orig = sanitizeNomeArquivo(file.name || 'arquivo');
  const storagePath = `subchamados/${sid}/${randomUUID()}-${orig}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from('subchamados-attachments').upload(storagePath, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { error: insErr } = await supabase.from('subchamado_anexos').insert({
    subchamado_id: sid,
    storage_path: storagePath,
    nome_original: orig,
    tamanho: file.size,
    tipo_mime: file.type || null,
    uploader_id: user.id,
    uploader_nome: uploaderNome,
  } as never);
  if (insErr) {
    await supabase.storage.from('subchamados-attachments').remove([storagePath]);
    return { ok: false, error: insErr.message };
  }

  revalidatePath(basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

export async function removerAnexoChamado(
  anexoId: string,
  storagePath: string,
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const id = String(anexoId ?? '').trim();
  const path = String(storagePath ?? '').trim();
  if (!id || !path) return { ok: false, error: 'Dados inválidos.' };

  const { data: row, error: fErr } = await supabase
    .from('chamado_anexos')
    .select('id, uploader_id')
    .eq('id', id)
    .maybeSingle();
  if (fErr || !row) return { ok: false, error: 'Anexo não encontrado.' };
  const up = (row as { uploader_id?: string | null }).uploader_id;
  const adminTeam = await perfilEhAdminOuTeam(supabase, user.id);
  if (!adminTeam && up !== user.id) return { ok: false, error: 'Sem permissão para excluir.' };

  await supabase.storage.from('chamados-attachments').remove([path]);
  const { error: delE } = await supabase.from('chamado_anexos').delete().eq('id', id);
  if (delE) return { ok: false, error: delE.message };

  revalidatePath(basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

export async function removerAnexoSubchamado(
  anexoId: string,
  storagePath: string,
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const id = String(anexoId ?? '').trim();
  const path = String(storagePath ?? '').trim();
  if (!id || !path) return { ok: false, error: 'Dados inválidos.' };

  const { data: row, error: fErr } = await supabase
    .from('subchamado_anexos')
    .select('id, uploader_id')
    .eq('id', id)
    .maybeSingle();
  if (fErr || !row) return { ok: false, error: 'Anexo não encontrado.' };
  const up = (row as { uploader_id?: string | null }).uploader_id;
  const adminTeam = await perfilEhAdminOuTeam(supabase, user.id);
  if (!adminTeam && up !== user.id) return { ok: false, error: 'Sem permissão para excluir.' };

  await supabase.storage.from('subchamados-attachments').remove([path]);
  const { error: delE } = await supabase.from('subchamado_anexos').delete().eq('id', id);
  if (delE) return { ok: false, error: delE.message };

  revalidatePath(basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

// ─── Checklist por card ───────────────────────────────────────────────────────

export type ChecklistItem = {
  id: string;
  card_id: string;
  texto: string;
  feito: boolean;
  responsavel_id: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  responsavel?: { full_name: string | null } | null;
};

export async function listarChecklistCard(cardId: string): Promise<ChecklistItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('kanban_checklist_itens')
    .select('*, responsavel:responsavel_id(full_name)')
    .eq('card_id', cardId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []) as ChecklistItem[];
}

export async function criarChecklistItem(input: {
  card_id: string;
  texto: string;
  responsavel_id: string | null;
  basePath?: string;
}): Promise<{ ok: boolean; error?: string; item?: ChecklistItem }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data, error } = await supabase
    .from('kanban_checklist_itens')
    .insert({ card_id: input.card_id, texto: input.texto.trim(), responsavel_id: input.responsavel_id || null, criado_por: user.id })
    .select('*, responsavel:responsavel_id(full_name)')
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true, item: data as ChecklistItem };
}

export async function toggleChecklistItem(input: {
  id: string;
  feito: boolean;
  basePath?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { error } = await supabase
    .from('kanban_checklist_itens')
    .update({ feito: input.feito, updated_at: new Date().toISOString() })
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}

export async function deletarChecklistItem(input: {
  id: string;
  basePath?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { error } = await supabase
    .from('kanban_checklist_itens')
    .delete()
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}

// ─── Aprovação de passagem de fase ───────────────────────────────────────────

export async function verificarChecklistParaFase(
  cardId: string,
): Promise<{ bloqueado: boolean; itens_pendentes: number }> {
  const supabase = await createClient();
  const cid = String(cardId ?? '').trim();
  if (!cid) return { bloqueado: false, itens_pendentes: 0 };

  const { data, error } = await supabase
    .from('kanban_checklist_itens')
    .select('id')
    .eq('card_id', cid)
    .eq('feito', false);

  if (error) return { bloqueado: false, itens_pendentes: 0 };
  const count = (data ?? []).length;
  return { bloqueado: count > 0, itens_pendentes: count };
}

export async function solicitarAprovacaoFase(input: {
  card_id: string;
  fase_destino: string;
  card_titulo: string;
  itens_pendentes: number;
  basePath?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para solicitar aprovação.' };

  const cid = String(input.card_id ?? '').trim();
  const faseDest = String(input.fase_destino ?? '').trim();
  if (!cid || !faseDest) return { ok: false, error: 'Dados inválidos.' };

  const { data: prof } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();
  const nomeSolicitante =
    String((prof as { full_name?: string | null } | null)?.full_name ?? '').trim() || 'Alguém';

  const { error: insErr } = await supabase.from('kanban_aprovacoes_fase').insert({
    card_id: cid,
    solicitado_por: user.id,
    fase_destino: faseDest,
    status: 'pendente',
  } as never);
  if (insErr) return { ok: false, error: insErr.message };

  const { data: bombeiros } = await supabase
    .from('sirene_papeis')
    .select('user_id')
    .eq('papel', 'bombeiro');

  const titulo = 'Solicitação de aprovação de fase';
  const n = input.itens_pendentes;
  const pendentesStr = n === 1 ? '1 item de checklist pendente' : `${n} itens de checklist pendentes`;
  const mensagem = `${nomeSolicitante} quer mover o card "${input.card_titulo}" para a próxima fase, mas há ${pendentesStr}.`;

  for (const b of bombeiros ?? []) {
    const uid = String((b as { user_id: string }).user_id);
    await supabase.from('sirene_notificacoes').insert({
      user_id: uid,
      chamado_id: null,
      tipo: 'aprovacao_fase',
      texto: mensagem,
      titulo,
      mensagem,
    } as never);
  }

  revalidatePath(input.basePath?.trim() || '/');
  revalidatePath('/sirene/monitor');
  revalidatePath('/');
  return { ok: true };
}

function revalidateAprovacaoFaseEMonitor() {
  revalidatePath('/sirene/monitor');
  for (const p of KANBAN_APP_BASE_PATHS) revalidatePath(p);
  revalidatePath('/');
}

export type AprovacaoFasePendente = {
  id: string;
  card_id: string;
  fase_destino: string;
  solicitado_por: string;
  created_at: string;
  card_titulo: string;
  funil_nome: string;
  solicitante_nome: string;
  itens_pendentes: number;
};

function cardEmbedRow(
  raw: unknown,
): { titulo: string; funil_nome: string } {
  const r = raw as
    | { titulo?: string; kanbans?: { nome?: string } | { nome?: string }[] | null }
    | { titulo?: string; kanbans?: { nome?: string } | { nome?: string }[] | null }[]
    | null
    | undefined;
  const node = Array.isArray(r) ? r[0] : r;
  if (!node) return { titulo: '—', funil_nome: 'Funil' };
  const k = node.kanbans;
  const kn = Array.isArray(k) ? k[0] : k;
  const funil = String(kn?.nome ?? 'Funil').trim() || 'Funil';
  return { titulo: String(node.titulo ?? '—').trim() || '—', funil_nome: funil };
}

export async function listarAprovacoesPendentes(): Promise<
  { ok: true; rows: AprovacaoFasePendente[] } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: isBombeiro } = await supabase
    .from('sirene_papeis')
    .select('papel')
    .eq('user_id', user.id)
    .eq('papel', 'bombeiro')
    .maybeSingle();
  if (!isBombeiro) return { ok: false, error: 'Acesso restrito a bombeiro.' };

  const { data: aprovs, error: aErr } = await supabase
    .from('kanban_aprovacoes_fase')
    .select(
      'id, card_id, fase_destino, solicitado_por, created_at, kanban_cards!inner ( titulo, kanbans ( nome ) )',
    )
    .eq('status', 'pendente')
    .order('created_at', { ascending: true });
  if (aErr) return { ok: false, error: aErr.message };

  const rows = (aprovs ?? []) as {
    id: string;
    card_id: string;
    fase_destino: string;
    solicitado_por: string;
    created_at: string;
    kanban_cards: unknown;
  }[];
  const cardIds = rows.map((r) => r.card_id);
  const solicitIds = [...new Set(rows.map((r) => r.solicitado_por))];

  const { data: profs } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', solicitIds);
  const nomePorId = new Map(
    (profs ?? []).map((p) => [
      p.id as string,
      String(p.full_name ?? '').trim() || 'Solicitante',
    ]),
  );

  let checklistPend: { card_id: string }[] | null = null;
  if (cardIds.length) {
    const { data: ck } = await supabase
      .from('kanban_checklist_itens')
      .select('card_id')
      .in('card_id', cardIds)
      .eq('feito', false);
    checklistPend = (ck ?? []) as { card_id: string }[];
  }
  const pendentesPorCard = new Map<string, number>();
  for (const c of cardIds) pendentesPorCard.set(c, 0);
  for (const it of checklistPend ?? []) pendentesPorCard.set(
    it.card_id,
    (pendentesPorCard.get(it.card_id) ?? 0) + 1,
  );

  return {
    ok: true,
    rows: rows.map((r) => {
      const { titulo, funil_nome } = cardEmbedRow(r.kanban_cards);
      const name = nomePorId.get(r.solicitado_por) ?? 'Solicitante';
      return {
        id: r.id,
        card_id: r.card_id,
        fase_destino: r.fase_destino,
        solicitado_por: r.solicitado_por,
        created_at: r.created_at,
        card_titulo: titulo,
        funil_nome: funil_nome,
        solicitante_nome: name,
        itens_pendentes: pendentesPorCard.get(r.card_id) ?? 0,
      };
    }),
  };
}

export async function aprovarPassagemFase(aprovacaoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: isBombeiro } = await supabase
    .from('sirene_papeis')
    .select('papel')
    .eq('user_id', user.id)
    .eq('papel', 'bombeiro')
    .maybeSingle();
  if (!isBombeiro) return { ok: false, error: 'Apenas bombeiro pode aprovar.' };

  const id = String(aprovacaoId ?? '').trim();
  if (!id) return { ok: false, error: 'Solicitação inválida.' };

  const { data: aprov, error: rErr } = await supabase
    .from('kanban_aprovacoes_fase')
    .select('id, card_id, fase_destino, status')
    .eq('id', id)
    .eq('status', 'pendente')
    .maybeSingle();
  if (rErr) return { ok: false, error: rErr.message };
  if (!aprov) return { ok: false, error: 'Aprovação não encontrada ou já tratada.' };

  const aprovRow = aprov as { id: string; card_id: string; fase_destino: string; status: string };
  const fase = String(aprovRow.fase_destino ?? '').trim();
  if (!fase) return { ok: false, error: 'Fase de destino inválida.' };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Serviço indisponível.' };
  }

  const now = new Date().toISOString();
  const { error: cErr } = await admin
    .from('kanban_cards')
    .update({ fase_id: fase })
    .eq('id', aprovRow.card_id);
  if (cErr) return { ok: false, error: cErr.message };

  const { error: uErr } = await supabase
    .from('kanban_aprovacoes_fase')
    .update({ status: 'aprovado', aprovado_por: user.id, updated_at: now })
    .eq('id', aprovRow.id);
  if (uErr) return { ok: false, error: uErr.message };

  revalidateAprovacaoFaseEMonitor();
  return { ok: true };
}

export async function rejeitarPassagemFase(aprovacaoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: isBombeiro } = await supabase
    .from('sirene_papeis')
    .select('papel')
    .eq('user_id', user.id)
    .eq('papel', 'bombeiro')
    .maybeSingle();
  if (!isBombeiro) return { ok: false, error: 'Apenas bombeiro pode rejeitar.' };

  const id = String(aprovacaoId ?? '').trim();
  if (!id) return { ok: false, error: 'Solicitação inválida.' };

  const { data: aprov, error: rErr } = await supabase
    .from('kanban_aprovacoes_fase')
    .select('id, card_id, solicitado_por, status, kanban_cards!inner ( titulo )')
    .eq('id', id)
    .eq('status', 'pendente')
    .maybeSingle();
  if (rErr) return { ok: false, error: rErr.message };
  if (!aprov) return { ok: false, error: 'Aprovação não encontrada ou já tratada.' };

  const row = aprov as {
    id: string;
    card_id: string;
    solicitado_por: string;
    status: string;
    kanban_cards: unknown;
  };
  const { titulo: tCard } = cardEmbedRow(row.kanban_cards);
  const cardTit = tCard !== '—' ? tCard : 'Card';

  const { data: perfBombeiro } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();
  const nomeBom = String(perfBombeiro?.full_name ?? '').trim() || 'Bombeiro';

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Serviço indisponível.' };
  }

  const now = new Date().toISOString();
  const { error: uErr } = await supabase
    .from('kanban_aprovacoes_fase')
    .update({ status: 'rejeitado', aprovado_por: user.id, updated_at: now })
    .eq('id', row.id);
  if (uErr) return { ok: false, error: uErr.message };

  const mensagem = `${nomeBom} rejeitou a solicitação de avanço do card "${cardTit}"`;
  const { error: nErr } = await admin.from('sirene_notificacoes').insert({
    user_id: row.solicitado_por,
    chamado_id: null,
    tipo: 'aprovacao_rejeitada',
    titulo: 'Passagem de fase rejeitada',
    mensagem,
    texto: mensagem,
    referencia_id: null,
    referencia_card_id: row.card_id,
  } as never);
  if (nErr) return { ok: false, error: nErr.message };

  revalidateAprovacaoFaseEMonitor();
  return { ok: true };
}

// ─── Form tokens para candidatos ────────────────────────────────────────────

export async function gerarFormTokenCandidato(
  cardId: string,
  faseId: string,
): Promise<{ ok: true; token: string; url: string } | ActionErr> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Serviço indisponível.' };
  }

  // Busca itens "Nome" e "E-mail" da fase para pré-popular o token de cobrança
  const { data: itens } = await admin
    .from('kanban_fase_checklist_itens')
    .select('id, label')
    .eq('fase_id', faseId)
    .in('label', ['Nome', 'E-mail']);

  const itemPorLabel = new Map<string, string>();
  for (const it of (itens ?? []) as { id: string; label: string }[]) {
    itemPorLabel.set(it.label, it.id);
  }

  let nomeCandidato: string | null = null;
  let emailCandidato: string | null = null;
  const itemIds = [...itemPorLabel.values()];
  if (itemIds.length) {
    const { data: resps } = await admin
      .from('kanban_fase_checklist_respostas')
      .select('item_id, valor')
      .eq('card_id', cardId)
      .in('item_id', itemIds);

    const valorPorItem = new Map<string, string>();
    for (const r of (resps ?? []) as { item_id: string; valor: string | null }[]) {
      if (r.valor) valorPorItem.set(r.item_id, r.valor);
    }
    const nomeId = itemPorLabel.get('Nome');
    const emailId = itemPorLabel.get('E-mail');
    if (nomeId) nomeCandidato = valorPorItem.get(nomeId) ?? null;
    if (emailId) emailCandidato = valorPorItem.get(emailId) ?? null;
  }

  const { data, error } = await admin
    .from('kanban_card_form_tokens')
    .insert({
      card_id: cardId,
      fase_id: faseId,
      created_by: user.id,
      nome_candidato: nomeCandidato,
      email_candidato: emailCandidato,
    })
    .select('token')
    .single();
  if (error) return { ok: false, error: error.message };

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'http://localhost:3000';
  const token = String((data as { token: string }).token);
  return { ok: true, token, url: `${baseUrl}/formulario-candidato/${token}` };
}

// ─── E-mail a partir do card ─────────────────────────────────────────────────

export type EnviarEmailCardInput = {
  card_id: string;
  para: string;
  assunto: string;
  mensagem: string;
  basePath?: string;
};

export async function enviarEmailCard(input: EnviarEmailCardInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const para = input.para.trim();
  const assunto = input.assunto.trim();
  const mensagem = input.mensagem.trim();
  if (!para || !assunto || !mensagem) return { ok: false, error: 'Preencha todos os campos.' };

  const { sendEmailViaResend } = await import('@/lib/email');
  const result = await sendEmailViaResend({
    to: para,
    subject: assunto,
    text: mensagem,
    html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${mensagem.replace(/\n/g, '<br>')}</div>`,
  });
  if (!result.ok) return { ok: false, error: result.error };

  const textoComentario = `[E-mail para: ${para}] ${assunto}\n\n${mensagem}`;
  const { error: insErr } = await supabase.from('kanban_card_comentarios').insert({
    card_id: input.card_id,
    autor_id: user.id,
    texto: textoComentario,
  });
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}

// ─── Checklist estrutural por fase ──────────────────────────────────────────
// `FaseChecklistItem` (tipos incl. `data`, `hora`) em `candidato-actions`; reexportado aqui.

export type FaseChecklistResposta = {
  id: string;
  item_id: string;
  card_id: string;
  valor: string | null;
  arquivo_path: string | null;
  preenchido_por: string | null;
  preenchido_em: string | null;
};

export async function listarFaseChecklistItens(faseId: string): Promise<FaseChecklistItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id, fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, template_storage_path, placeholder')
    .eq('fase_id', faseId)
    .order('ordem', { ascending: true });
  return (data ?? []) as FaseChecklistItem[];
}

export async function listarFaseChecklistRespostas(cardId: string): Promise<FaseChecklistResposta[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('id, item_id, card_id, valor, arquivo_path, preenchido_por, preenchido_em')
    .eq('card_id', cardId);
  return (data ?? []) as FaseChecklistResposta[];
}

export async function upsertFaseChecklistResposta(input: {
  item_id: string;
  card_id: string;
  valor?: string | null;
  arquivo_path?: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { error } = await supabase.from('kanban_fase_checklist_respostas').upsert(
    {
      item_id: input.item_id,
      card_id: input.card_id,
      valor: input.valor ?? null,
      arquivo_path: input.arquivo_path ?? null,
      preenchido_por: user.id,
      preenchido_em: new Date().toISOString(),
    },
    { onConflict: 'item_id,card_id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
