'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { KanbanFaseMaterial } from '@/components/kanban-shared/types';
import { parseKanbanFaseMateriais } from '@/lib/kanban/parse-kanban-fase-materiais';
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
