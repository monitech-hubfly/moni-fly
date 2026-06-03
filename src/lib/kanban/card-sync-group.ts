import type { createAdminClient } from '@/lib/supabase/admin';

type SyncDb = ReturnType<typeof createAdminClient>;

/** Resolve `processo_step_one.id` a partir do card kanban (sem importar módulo server-only). */
async function resolverProcessoIdDoCard(db: SyncDb, cardId: string): Promise<string | null> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return null;

  const { data: card } = await db.from('kanban_cards').select('projeto_id').eq('id', cid).maybeSingle();
  const projetoId = String((card as { projeto_id?: string | null } | null)?.projeto_id ?? '').trim();
  if (projetoId) return projetoId;

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
    if (Object.prototype.hasOwnProperty.call(patch, k)) {
      const v = patch[k];
      out[k] = v != null && String(v).trim() !== '' ? String(v) : null;
    }
  }
  return out;
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
  return fb || null;
}

async function nFranquiaDeRede(db: SyncDb, redeId: string | null | undefined): Promise<string | null> {
  const rid = String(redeId ?? '').trim();
  if (!rid) return null;
  const { data } = await db.from('rede_franqueados').select('n_franquia').eq('id', rid).maybeSingle();
  return String((data as { n_franquia?: string | null } | null)?.n_franquia ?? '').trim() || null;
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
    syncPatch.rede_franqueado_id !== undefined ||
    syncPatch.nome_condominio !== undefined ||
    syncPatch.quadra !== undefined ||
    syncPatch.lote !== undefined;

  for (const targetId of cardIds) {
    const rowPatch: Record<string, string | null> = { ...syncPatch };

    if (precisaTitulo && rowPatch.titulo === undefined) {
      const { data: cur } = await db
        .from('kanban_cards')
        .select('rede_franqueado_id, nome_condominio, quadra, lote, titulo')
        .eq('id', targetId)
        .maybeSingle();
      const c = cur as {
        rede_franqueado_id?: string | null;
        nome_condominio?: string | null;
        quadra?: string | null;
        lote?: string | null;
        titulo?: string | null;
      } | null;

      const redeId = rowPatch.rede_franqueado_id ?? c?.rede_franqueado_id ?? null;
      const nFq = await nFranquiaDeRede(db, redeId);
      const titulo = montarTituloCardSync({
        nFranquia: nFq,
        nomeCondominio: rowPatch.nome_condominio ?? c?.nome_condominio,
        quadra: rowPatch.quadra ?? c?.quadra,
        lote: rowPatch.lote ?? c?.lote,
        tituloFallback: c?.titulo,
      });
      if (titulo) rowPatch.titulo = titulo;
    }

    const { error } = await db.from('kanban_cards').update(rowPatch as never).eq('id', targetId);
    if (error) return { ok: false, error: error.message };
    atualizados++;
  }

  if (!options?.skipProcessoMirror) {
    const processoPatch = pickSyncFields(
      {
        nome_condominio: syncPatch.nome_condominio,
        condominio_id: syncPatch.condominio_id,
        quadra: syncPatch.quadra,
        lote: syncPatch.lote,
        origem_rede_franqueados_id: syncPatch.rede_franqueado_id,
        numero_franquia: undefined as string | null | undefined,
      },
      ['nome_condominio', 'condominio_id', 'quadra', 'lote', 'origem_rede_franqueados_id'],
    );

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

  const { error: errProc } = await db
    .from('processo_step_one')
    .update({ ...procPatch, updated_at: new Date().toISOString() } as never)
    .eq('id', pid);
  if (errProc) return { ok: false, error: errProc.message };

  const kanbanMirror: KanbanCardCamposSync = {};
  if (procPatch.nome_condominio !== undefined) kanbanMirror.nome_condominio = procPatch.nome_condominio;
  if (procPatch.condominio_id !== undefined) kanbanMirror.condominio_id = procPatch.condominio_id;
  if (procPatch.quadra !== undefined) kanbanMirror.quadra = procPatch.quadra;
  if (procPatch.lote !== undefined) kanbanMirror.lote = procPatch.lote;
  if (procPatch.origem_rede_franqueados_id !== undefined) {
    kanbanMirror.rede_franqueado_id = procPatch.origem_rede_franqueados_id;
  }

  if (Object.keys(kanbanMirror).length > 0) {
    const sync = await propagarCamposKanbanCards(db, origem, kanbanMirror, { skipProcessoMirror: true });
    if (!sync.ok) return sync;
  }

  return { ok: true };
}

/** Campos compartilhados canônicos para o modal (leitura). */
export async function fetchCamposKanbanCanonicos(
  db: SyncDb,
  cardId: string,
): Promise<KanbanCardCamposSync | null> {
  const primario = await resolverCardPrimarioSyncGroup(db, cardId);
  const { data, error } = await db
    .from('kanban_cards')
    .select(KANBAN_CARD_CAMPOS_SYNC.join(','))
    .eq('id', primario)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as Record<string, unknown>;
  const out: KanbanCardCamposSync = {};
  for (const k of KANBAN_CARD_CAMPOS_SYNC) {
    if (row[k] !== undefined) out[k] = row[k] != null ? String(row[k]) : null;
  }
  return out;
}
