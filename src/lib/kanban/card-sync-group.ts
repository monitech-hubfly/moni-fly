import type { createAdminClient } from '@/lib/supabase/admin';
import type { createClient } from '@/lib/supabase/server';

type SyncDb = Pick<Awaited<ReturnType<typeof createClient>>, 'from'>;

export function extrairNumeroFranquiaDoTitulo(titulo: string): string {
  const t = titulo.trim();
  if (!t) return '';
  const i = t.indexOf(' - ');
  return i >= 0 ? t.slice(0, i).trim() : t;
}

/** Remove o segmento do nome do franqueado em títulos legados `FK - Nome - …`. */
function tituloFallbackSemFranqueado(fb: string, nFranquia: string | null | undefined): string {
  const t = fb.trim();
  if (!t) return t;
  const parts = t.split(' - ').filter(Boolean);
  if (parts.length <= 1) return t;
  const num = (nFranquia ?? '').trim() || parts[0]!;
  if (parts[0] !== num) return t;
  if (parts.length === 2) return num;
  return [num, ...parts.slice(2)].join(' - ');
}

function tituloParaNumeroFranquiaSync(titulo: string): string {
  return extrairNumeroFranquiaDoTitulo(titulo);
}

async function resolveProcessoIdByNumeroFranquia(db: SyncDb, num: string): Promise<string | null> {
  const n = num.trim();
  if (!n) return null;
  const { data: byNum } = await db
    .from('processo_step_one')
    .select('id')
    .eq('numero_franquia', n)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nid = (byNum as { id?: string } | null)?.id;
  return nid ? String(nid) : null;
}

/**
 * Resolve `processo_step_one.id` para card kanban.
 * `kanban_cards.projeto_id` pode apontar para `projeto_negocio` (Portfolio) ou `processo_step_one` (Step One).
 */
export async function resolverProcessoStepOneIdDoCard(
  db: SyncDb,
  params: {
    cardProjetoId?: string | null;
    redeFranqueadoId?: string | null;
    cardTitulo?: string | null;
  },
): Promise<string | null> {
  const projetoId = String(params.cardProjetoId ?? '').trim();
  if (projetoId) {
    const { data: byProjeto } = await db.from('processo_step_one').select('id').eq('id', projetoId).maybeSingle();
    if (byProjeto?.id) return String(byProjeto.id);
  }

  const redeId = String(params.redeFranqueadoId ?? '').trim();
  if (redeId) {
    const { data: rede } = await db
      .from('rede_franqueados')
      .select('processo_id, id, n_franquia')
      .eq('id', redeId)
      .maybeSingle();
    const redeRow = rede as { processo_id?: string | null; id?: string; n_franquia?: string | null } | null;
    const redeProcessoId = String(redeRow?.processo_id ?? '').trim();
    if (redeProcessoId) return redeProcessoId;

    const rid = String(redeRow?.id ?? '').trim();
    if (rid) {
      const { data: byOrigem } = await db
        .from('processo_step_one')
        .select('id')
        .eq('origem_rede_franqueados_id', rid)
        .maybeSingle();
      const oid = (byOrigem as { id?: string } | null)?.id;
      if (oid) return String(oid);
    }

    const numRede = String(redeRow?.n_franquia ?? '').trim();
    if (numRede) {
      const byNumRede = await resolveProcessoIdByNumeroFranquia(db, numRede);
      if (byNumRede) return byNumRede;
    }
  }

  const numTitulo = tituloParaNumeroFranquiaSync(String(params.cardTitulo ?? ''));
  if (numTitulo) {
    const byNumTitulo = await resolveProcessoIdByNumeroFranquia(db, numTitulo);
    if (byNumTitulo) return byNumTitulo;
  }

  return null;
}

/** Resolve `processo_step_one.id` a partir do card kanban (sem importar módulo server-only). */
async function resolverProcessoIdDoCard(db: SyncDb, cardId: string): Promise<string | null> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return null;

  const { data: card } = await db
    .from('kanban_cards')
    .select('projeto_id, rede_franqueado_id, titulo')
    .eq('id', cid)
    .maybeSingle();
  const row = card as { projeto_id?: string | null; rede_franqueado_id?: string | null; titulo?: string | null } | null;

  const resolved = await resolverProcessoStepOneIdDoCard(db, {
    cardProjetoId: row?.projeto_id,
    redeFranqueadoId: row?.rede_franqueado_id,
    cardTitulo: row?.titulo,
  });
  if (resolved) return resolved;

  const { data: proc } = await db.from('processo_step_one').select('id').eq('id', cid).maybeSingle();
  return proc?.id ? String(proc.id) : null;
}

/** Campos de `kanban_cards` replicados em todos os cards do grupo de sync. */
export const KANBAN_CARD_CAMPOS_SYNC = [
  'titulo',
  'rede_franqueado_id',
  'nome_condominio',
  'condominio_id',
  'quadra',
  'lote',
  'data_reuniao',
  'data_followup',
] as const;

export type KanbanCardCamposSync = Partial<
  Record<(typeof KANBAN_CARD_CAMPOS_SYNC)[number], string | null>
>;

/** Campos de `processo_step_one` compartilhados (negócio + pré-obra + condomínio). */
export const PROCESSO_CAMPOS_SYNC = [
  'tipo_aquisicao_terreno',
  'valor_terreno',
  'vgv_pretendido',
  'produto_modelo_casa',
  'link_pasta_drive',
  'link_bca',
  'link_gbox',
  'link_mapa_competidores',
  'link_acoplamento',
  'link_apresentacao_comite',
  'anexo_opcao_permuta_path',
  'anexo_contrato_permuta_path',
  'anexo_seguro_garantia_path',
  'link_moni_capital_seguro_garantia',
  'comentario_moni_capital_seguro_garantia',
  'link_moni_capital_gastos_aporte_inicial',
  'comentario_moni_capital_gastos_aporte_inicial',
  'nome_condominio',
  'condominio_id',
  'quadra_lote',
  'quadra',
  'lote',
  'previsao_aprovacao_condominio',
  'previsao_aprovacao_prefeitura',
  'previsao_emissao_alvara',
  'previsao_liberacao_credito_obra',
  'previsao_inicio_obra',
  'data_aprovacao_condominio',
  'data_aprovacao_prefeitura',
  'data_emissao_alvara',
  'data_aprovacao_credito',
  'numero_franquia',
  'origem_rede_franqueados_id',
] as const;

export type ProcessoCamposSync = Partial<Record<(typeof PROCESSO_CAMPOS_SYNC)[number], string | null>>;

/** Campos que permanecem por funil/card (não sincronizar). */
export const CAMPOS_NAO_SYNC = [
  'fase_id',
  'kanban_id',
  'status',
  'concluido',
  'concluido_em',
  'arquivado',
  'arquivado_em',
  'ordem_coluna',
  'origem_card_id',
  'projeto_id',
  'franqueado_id',
  'sla_iniciado_em',
  'acoplamento_concluido',
  'credito_terreno_ok',
  'credito_obra_ok',
  'contabilidade_ok',
  'juridico_ok',
  'capital_ok',
  'alvara_url',
  'docs_terreno_url',
] as const;

function pickSyncFields<T extends Record<string, unknown>>(
  patch: T,
  allowed: readonly string[],
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const k of allowed) {
    if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
    const v = patch[k];
    // `undefined` = campo omitido do patch; não deve zerar dados existentes.
    if (v === undefined) continue;
    out[k] = v != null && String(v).trim() !== '' ? String(v) : null;
  }
  return out;
}

/** Campos que não devem ser propagados como `null` (evita wipe ao sincronizar grupo). */
const KANBAN_CAMPOS_ANTI_NULL_SYNC = new Set<string>([
  'rede_franqueado_id',
  'data_followup',
  'data_reuniao',
]);

function omitNullStickyKanbanFields(patch: Record<string, string | null>): Record<string, string | null> {
  const out: Record<string, string | null> = { ...patch };
  for (const k of KANBAN_CAMPOS_ANTI_NULL_SYNC) {
    if (out[k] === null) delete out[k];
  }
  return out;
}

function coalesceCampoSync(
  atual: string | null | undefined,
  candidato: string | null | undefined,
): string | null {
  const c = String(candidato ?? '').trim();
  if (c) return c;
  const a = String(atual ?? '').trim();
  return a || null;
}

/** BFS em `kanban_card_vinculos` (bidirecional). */
async function expandirVinculos(db: SyncDb, ids: Set<string>): Promise<void> {
  let frontier = [...ids];
  const seenEdges = new Set<string>();

  while (frontier.length > 0) {
    const batch = frontier;
    frontier = [];

    for (const cid of batch) {
      const { data: vinculos } = await db
        .from('kanban_card_vinculos')
        .select('card_origem_id, card_destino_id')
        .or(`card_origem_id.eq.${cid},card_destino_id.eq.${cid}`);

      for (const v of vinculos ?? []) {
        const a = String((v as { card_origem_id?: string }).card_origem_id ?? '').trim();
        const b = String((v as { card_destino_id?: string }).card_destino_id ?? '').trim();
        const edgeKey = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (seenEdges.has(edgeKey)) continue;
        seenEdges.add(edgeKey);

        for (const nid of [a, b]) {
          if (!nid || ids.has(nid)) continue;
          ids.add(nid);
          frontier.push(nid);
        }
      }
    }
  }
}

/** Sobe `origem_card_id` até a raiz e inclui todos os descendentes. */
async function expandirOrigemCardId(db: SyncDb, ids: Set<string>): Promise<void> {
  const cardIds = [...ids];
  for (const cid of cardIds) {
    let cur = cid;
    for (let depth = 0; depth < 32; depth++) {
      const { data: row } = await db
        .from('kanban_cards')
        .select('origem_card_id')
        .eq('id', cur)
        .maybeSingle();
      const pai = String((row as { origem_card_id?: string | null } | null)?.origem_card_id ?? '').trim();
      if (!pai || ids.has(pai)) break;
      ids.add(pai);
      cur = pai;
    }
  }

  let frontier = [...ids];
  for (let depth = 0; depth < 32 && frontier.length > 0; depth++) {
    const { data: filhos } = await db
      .from('kanban_cards')
      .select('id')
      .in('origem_card_id', frontier);
    const novos: string[] = [];
    for (const f of filhos ?? []) {
      const id = String((f as { id?: string }).id ?? '').trim();
      if (!id || ids.has(id)) continue;
      ids.add(id);
      novos.push(id);
    }
    frontier = novos;
  }
}

/** Inclui shadow cards e cards nativos ligados ao mesmo `processo_step_one`. */
async function expandirProcessoShadow(db: SyncDb, ids: Set<string>): Promise<void> {
  const processoIds = new Set<string>();
  for (const cid of [...ids]) {
    const pid = await resolverProcessoIdDoCard(db, cid);
    if (pid) processoIds.add(pid);
  }

  for (const pid of processoIds) {
    ids.add(pid);

    const { data: porProjeto } = await db.from('kanban_cards').select('id').eq('projeto_id', pid);
    for (const row of porProjeto ?? []) {
      const id = String((row as { id?: string }).id ?? '').trim();
      if (id) ids.add(id);
    }
  }
}

/**
 * Grupo de sync: vínculos bidirecionais + cadeia origem_card_id + cards do mesmo processo (shadow).
 */
export async function listarCardIdsSyncGroup(db: SyncDb, startCardId: string): Promise<string[]> {
  const cid = String(startCardId ?? '').trim();
  if (!cid) return [];

  const ids = new Set<string>([cid]);
  await expandirOrigemCardId(db, ids);
  await expandirVinculos(db, ids);
  await expandirProcessoShadow(db, ids);
  return [...ids];
}

export async function contarOutrosCardsSyncGroup(db: SyncDb, cardId: string): Promise<number> {
  const ids = await listarCardIdsSyncGroup(db, cardId);
  return Math.max(0, ids.length - 1);
}

/** Card raiz da cadeia `origem_card_id` dentro do grupo (para leitura canônica). */
export async function resolverCardPrimarioSyncGroup(db: SyncDb, cardId: string): Promise<string> {
  const ids = await listarCardIdsSyncGroup(db, cardId);
  const idSet = new Set(ids);
  if (ids.length === 0) return cardId;

  let cur = cardId;
  for (let depth = 0; depth < 32; depth++) {
    const { data: row } = await db
      .from('kanban_cards')
      .select('origem_card_id')
      .eq('id', cur)
      .maybeSingle();
    const pai = String((row as { origem_card_id?: string | null } | null)?.origem_card_id ?? '').trim();
    if (!pai || !idSet.has(pai)) return cur;
    cur = pai;
  }
  return cur;
}

export function montarTituloCardSync(params: {
  nFranquia?: string | null;
  /** Ignorado no título — nome do franqueado fica no subtítulo do card. */
  nomeFranqueado?: string | null;
  nomeCondominio?: string | null;
  quadra?: string | null;
  lote?: string | null;
  tituloFallback?: string | null;
}): string | null {
  const partes = [
    params.nFranquia?.trim() ?? '',
    params.nomeCondominio?.trim() ?? '',
    params.quadra?.trim() ?? '',
    params.lote?.trim() ?? '',
  ].filter(Boolean);
  if (partes.length > 0) return partes.join(' - ');
  const fb = params.tituloFallback?.trim();
  if (!fb) return null;
  return tituloFallbackSemFranqueado(fb, params.nFranquia);
}

/** Prefere o título calculado (sem nome do franqueado). */
export function escolherTituloExibicaoCard(
  tituloAtual: string | null | undefined,
  tituloCalculado: string | null | undefined,
): string {
  const calc = String(tituloCalculado ?? '').trim();
  if (calc) return calc;
  const atual = String(tituloAtual ?? '').trim();
  return atual || '(sem título)';
}

export async function resolverTituloCardKanban(
  db: SyncDb,
  fields: {
    rede_franqueado_id?: string | null;
    nome_condominio?: string | null;
    quadra?: string | null;
    lote?: string | null;
    titulo?: string | null;
    n_franquia?: string | null;
    nome_franqueado?: string | null;
  },
): Promise<string | null> {
  const nFq =
    String(fields.n_franquia ?? '').trim() ||
    (await nFranquiaDeRede(db, fields.rede_franqueado_id));
  return montarTituloCardSync({
    nFranquia: nFq,
    nomeCondominio: fields.nome_condominio,
    quadra: fields.quadra,
    lote: fields.lote,
    tituloFallback: fields.titulo,
  });
}

async function redeTituloFieldsDeRede(
  db: SyncDb,
  redeId: string | null | undefined,
): Promise<{ nFranquia: string | null; nomeFranqueado: string | null }> {
  const rid = String(redeId ?? '').trim();
  if (!rid) return { nFranquia: null, nomeFranqueado: null };
  const { data } = await db.from('rede_franqueados').select('n_franquia, nome_completo').eq('id', rid).maybeSingle();
  return {
    nFranquia: String((data as { n_franquia?: string | null } | null)?.n_franquia ?? '').trim() || null,
    nomeFranqueado:
      String((data as { nome_completo?: string | null } | null)?.nome_completo ?? '').trim() || null,
  };
}

async function nFranquiaDeRede(db: SyncDb, redeId: string | null | undefined): Promise<string | null> {
  const { nFranquia } = await redeTituloFieldsDeRede(db, redeId);
  return nFranquia;
}

/**
 * Propaga campos compartilhados de `kanban_cards` para todo o grupo.
 * Não reentra em save actions — evita loops.
 */
export async function propagarCamposKanbanCards(
  db: SyncDb,
  cardOrigemId: string,
  patch: KanbanCardCamposSync,
  options?: { skipProcessoMirror?: boolean },
): Promise<{ ok: true; atualizados: number } | { ok: false; error: string }> {
  const origem = String(cardOrigemId ?? '').trim();
  if (!origem) return { ok: false, error: 'Card inválido.' };

  const syncPatch = pickSyncFields(patch as Record<string, unknown>, KANBAN_CARD_CAMPOS_SYNC);
  if (Object.keys(syncPatch).length === 0) return { ok: true, atualizados: 0 };

  const cardIds = await listarCardIdsSyncGroup(db, origem);
  let atualizados = 0;

  const precisaTitulo =
    syncPatch.titulo !== undefined ||
    syncPatch.rede_franqueado_id !== undefined ||
    syncPatch.nome_condominio !== undefined ||
    syncPatch.quadra !== undefined ||
    syncPatch.lote !== undefined;

  let tituloCanonico: string | null | undefined =
    syncPatch.titulo !== undefined ? syncPatch.titulo : undefined;

  if (precisaTitulo && tituloCanonico === undefined) {
    const { data: origemRow } = await db
      .from('kanban_cards')
      .select('rede_franqueado_id, nome_condominio, quadra, lote, titulo')
      .eq('id', origem)
      .maybeSingle();
    const o = origemRow as {
      rede_franqueado_id?: string | null;
      nome_condominio?: string | null;
      quadra?: string | null;
      lote?: string | null;
      titulo?: string | null;
    } | null;

    tituloCanonico = await resolverTituloCardKanban(db, {
      rede_franqueado_id: syncPatch.rede_franqueado_id ?? o?.rede_franqueado_id,
      nome_condominio: syncPatch.nome_condominio ?? o?.nome_condominio,
      quadra: syncPatch.quadra ?? o?.quadra,
      lote: syncPatch.lote ?? o?.lote,
      titulo: o?.titulo,
    });
  }

  for (const targetId of cardIds) {
    const rowPatch = omitNullStickyKanbanFields({ ...syncPatch });

    if (tituloCanonico && rowPatch.titulo === undefined) {
      rowPatch.titulo = tituloCanonico;
    }

    if (Object.keys(rowPatch).length === 0) continue;

    const { error } = await db.from('kanban_cards').update(rowPatch as never).eq('id', targetId);
    if (error) return { ok: false, error: error.message };
    atualizados++;
  }

  if (!options?.skipProcessoMirror) {
    const processoSource: Record<string, unknown> = {};
    if (syncPatch.nome_condominio !== undefined) processoSource.nome_condominio = syncPatch.nome_condominio;
    if (syncPatch.condominio_id !== undefined) processoSource.condominio_id = syncPatch.condominio_id;
    if (syncPatch.quadra !== undefined) processoSource.quadra = syncPatch.quadra;
    if (syncPatch.lote !== undefined) processoSource.lote = syncPatch.lote;
    if (syncPatch.rede_franqueado_id !== undefined) {
      processoSource.origem_rede_franqueados_id = syncPatch.rede_franqueado_id;
    }

    const processoPatch = pickSyncFields(processoSource, [
      'nome_condominio',
      'condominio_id',
      'quadra',
      'lote',
      'origem_rede_franqueados_id',
    ]);

    if (syncPatch.rede_franqueado_id !== undefined) {
      const nFq = await nFranquiaDeRede(db, syncPatch.rede_franqueado_id);
      if (nFq) processoPatch.numero_franquia = nFq;
    }

    if (Object.keys(processoPatch).length > 0) {
      const processoIds = new Set<string>();
      for (const cid of cardIds) {
        const pid = await resolverProcessoIdDoCard(db, cid);
        if (pid) processoIds.add(pid);
      }
      for (const pid of processoIds) {
        const { error: pErr } = await db
          .from('processo_step_one')
          .update({ ...processoPatch, updated_at: new Date().toISOString() } as never)
          .eq('id', pid);
        if (pErr) return { ok: false, error: pErr.message };
      }
    }
  }

  return { ok: true, atualizados };
}

/** Atualiza `processo_step_one` canônico e espelha condomínio/título nos cards do grupo. */
export async function propagarCamposProcesso(
  db: SyncDb,
  cardOrigemId: string,
  processoId: string,
  patch: ProcessoCamposSync,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pid = String(processoId ?? '').trim();
  const origem = String(cardOrigemId ?? '').trim();
  if (!pid || !origem) return { ok: false, error: 'Processo ou card inválido.' };

  const procPatch = pickSyncFields(patch as Record<string, unknown>, PROCESSO_CAMPOS_SYNC);
  if (Object.keys(procPatch).length === 0) return { ok: true };

  const { data: updated, error: errProc } = await db
    .from('processo_step_one')
    .update({ ...procPatch, updated_at: new Date().toISOString() } as never)
    .eq('id', pid)
    .select('id')
    .maybeSingle();
  if (errProc) return { ok: false, error: errProc.message };
  if (!updated?.id) return { ok: false, error: 'Processo não encontrado ao salvar dados.' };

  const kanbanMirror: KanbanCardCamposSync = {};
  if (procPatch.nome_condominio !== undefined) kanbanMirror.nome_condominio = procPatch.nome_condominio;
  if (procPatch.condominio_id !== undefined) kanbanMirror.condominio_id = procPatch.condominio_id;
  if (procPatch.quadra !== undefined) kanbanMirror.quadra = procPatch.quadra;
  if (procPatch.lote !== undefined) kanbanMirror.lote = procPatch.lote;
  if (procPatch.origem_rede_franqueados_id != null && String(procPatch.origem_rede_franqueados_id).trim()) {
    kanbanMirror.rede_franqueado_id = procPatch.origem_rede_franqueados_id;
  }

  if (Object.keys(kanbanMirror).length > 0) {
    const sync = await propagarCamposKanbanCards(db, origem, kanbanMirror, { skipProcessoMirror: true });
    if (!sync.ok) return sync;
  }

  return { ok: true };
}

const CAMPOS_COALESCE_GRUPO_SYNC = new Set<string>([
  'rede_franqueado_id',
  'nome_condominio',
  'condominio_id',
  'quadra',
  'lote',
  'titulo',
  'data_reuniao',
  'data_followup',
]);

/** Campos compartilhados canônicos para o modal (leitura). */
export async function fetchCamposKanbanCanonicos(
  db: SyncDb,
  cardId: string,
): Promise<KanbanCardCamposSync | null> {
  const primario = await resolverCardPrimarioSyncGroup(db, cardId);
  const cardIds = await listarCardIdsSyncGroup(db, cardId);
  if (cardIds.length === 0) return null;

  const { data: rows, error } = await db
    .from('kanban_cards')
    .select(`id, ${KANBAN_CARD_CAMPOS_SYNC.join(',')}`)
    .in('id', cardIds);
  if (error || !rows?.length) return null;

  const typedRows = rows as unknown as Record<string, unknown>[];
  const primarioRow = typedRows.find((r) => String(r.id ?? '') === primario) ?? typedRows[0];
  const out: KanbanCardCamposSync = {};

  for (const k of KANBAN_CARD_CAMPOS_SYNC) {
    if (primarioRow[k] === undefined) continue;
    let valor: string | null = primarioRow[k] != null ? String(primarioRow[k]) : null;

    if (CAMPOS_COALESCE_GRUPO_SYNC.has(k)) {
      for (const row of typedRows) {
        if (row[k] === undefined) continue;
        const candidato = row[k] != null ? String(row[k]) : null;
        valor = coalesceCampoSync(valor, candidato);
      }
      if (k === 'titulo') {
        valor = escolherTituloExibicaoCard(
          primarioRow[k] != null ? String(primarioRow[k]) : null,
          valor,
        );
        if (valor === '(sem título)') valor = null;
      }
    }

    out[k] = valor;
  }

  const tituloRecalc = await resolverTituloCardKanban(db, {
    rede_franqueado_id: out.rede_franqueado_id,
    nome_condominio: out.nome_condominio,
    quadra: out.quadra,
    lote: out.lote,
    titulo: out.titulo,
  });
  if (tituloRecalc) {
    out.titulo = escolherTituloExibicaoCard(out.titulo, tituloRecalc);
    if (out.titulo === '(sem título)') out.titulo = null;
  }

  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Após vínculo/sync, propaga `rede_franqueado_id` do card que tem dado para os demais do grupo.
 * Nunca limpa com null.
 */
export async function reconciliarFranqueadoNoSyncGroup(
  db: SyncDb,
  startCardId: string,
): Promise<{ ok: true; atualizados: number } | { ok: false; error: string }> {
  const cardIds = await listarCardIdsSyncGroup(db, startCardId);
  if (cardIds.length === 0) return { ok: true, atualizados: 0 };

  const { data: rows, error } = await db
    .from('kanban_cards')
    .select('id, rede_franqueado_id, projeto_id, titulo')
    .in('id', cardIds);
  if (error) return { ok: false, error: error.message };

  let redeCanonica: string | null = null;
  for (const row of rows ?? []) {
    const rid = String((row as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? '').trim();
    if (rid) {
      redeCanonica = rid;
      break;
    }
  }

  if (!redeCanonica) {
    for (const row of rows ?? []) {
      const cardId = String((row as { id?: string }).id ?? '').trim();
      if (!cardId) continue;

      const processoId = await resolverProcessoIdDoCard(db, cardId);
      if (processoId) {
        const { data: proc } = await db
          .from('processo_step_one')
          .select('origem_rede_franqueados_id, numero_franquia')
          .eq('id', processoId)
          .maybeSingle();
        const procRow = proc as {
          origem_rede_franqueados_id?: string | null;
          numero_franquia?: string | null;
        } | null;
        const origemId = String(procRow?.origem_rede_franqueados_id ?? '').trim();
        if (origemId) {
          redeCanonica = origemId;
          break;
        }
        const numProc = String(procRow?.numero_franquia ?? '').trim();
        if (numProc) {
          const { data: rf } = await db
            .from('rede_franqueados')
            .select('id')
            .eq('n_franquia', numProc)
            .maybeSingle();
          const rfId = String((rf as { id?: string } | null)?.id ?? '').trim();
          if (rfId) {
            redeCanonica = rfId;
            break;
          }
        }
      }

      const numTitulo = tituloParaNumeroFranquiaSync(String((row as { titulo?: string | null }).titulo ?? ''));
      if (numTitulo) {
        const { data: rf } = await db
          .from('rede_franqueados')
          .select('id')
          .eq('n_franquia', numTitulo)
          .maybeSingle();
        const rfId = String((rf as { id?: string } | null)?.id ?? '').trim();
        if (rfId) {
          redeCanonica = rfId;
          break;
        }
      }
    }
  }

  if (!redeCanonica) return { ok: true, atualizados: 0 };

  let atualizados = 0;
  for (const row of rows ?? []) {
    const id = String((row as { id?: string }).id ?? '').trim();
    const atual = String((row as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? '').trim();
    if (!id || atual === redeCanonica) continue;
    const { error: upErr } = await db
      .from('kanban_cards')
      .update({ rede_franqueado_id: redeCanonica } as never)
      .eq('id', id);
    if (upErr) return { ok: false, error: upErr.message };
    atualizados++;
  }

  if (atualizados > 0) {
    const processoIds = new Set<string>();
    for (const cid of cardIds) {
      const pid = await resolverProcessoIdDoCard(db, cid);
      if (pid) processoIds.add(pid);
    }
    const nFq = await nFranquiaDeRede(db, redeCanonica);
    for (const pid of processoIds) {
      const procPatch: Record<string, string | null> = {
        origem_rede_franqueados_id: redeCanonica,
      };
      if (nFq) procPatch.numero_franquia = nFq;
      const { error: pErr } = await db
        .from('processo_step_one')
        .update({ ...procPatch, updated_at: new Date().toISOString() } as never)
        .eq('id', pid)
        .is('origem_rede_franqueados_id', null);
      if (pErr) return { ok: false, error: pErr.message };
    }
  }

  return { ok: true, atualizados };
}
