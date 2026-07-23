import type { createAdminClient } from '@/lib/supabase/admin';
import type { createClient } from '@/lib/supabase/server';
import { isKanbanFunilLoteadoresRef, sincronizarTituloCardLoteadores } from '@/lib/kanban/loteadores-card-titulo';
import {
  cardKanbanNaEsteiraPrincipalCalculadora,
  segmentoEsteiraCardCalculadora,
} from '@/lib/kanban/calculadora-fases-esteira';
import { tipoKanbanHistoricoFromAcao } from '@/lib/kanban/kanban-historico-tipo';
import {
  resolveUsuarioNomeHistorico,
  withKanbanHistoricoActor,
} from '@/lib/kanban/kanban-historico-actor';

type SyncDb = Pick<Awaited<ReturnType<typeof createClient>>, 'from' | 'rpc'>;

export function extrairNumeroFranquiaDoTitulo(titulo: string): string {
  const t = titulo.trim();
  if (!t) return '';
  const i = t.indexOf(' - ');
  return i >= 0 ? t.slice(0, i).trim() : t;
}

/** Extrai condomínio/quadra/lote de títulos `FK#### - …`. */
export function parseCamposDoTituloCard(titulo: string): {
  nomeCondominio?: string;
  quadra?: string;
  lote?: string;
} {
  const parts = titulo
    .split(' - ')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2 || !/^FK\d+/i.test(parts[0] ?? '')) return {};
  if (parts.length === 2) return { nomeCondominio: parts[1] };
  if (parts.length === 3) return { nomeCondominio: parts[1], quadra: parts[2] };
  return { nomeCondominio: parts[1], quadra: parts[2], lote: parts[3] };
}

/** Remove o segmento do nome do franqueado em títulos legados `FK - Nome - …`. */
function tituloFallbackSemFranqueado(fb: string, nFranquia: string | null | undefined): string {
  const t = fb.trim();
  if (!t) return t;
  const num = (nFranquia ?? '').trim();
  const parts = t.split(' - ').filter(Boolean);
  if (parts.length <= 1) {
    // Título legado só com nome do franqueado → substituir pelo FK quando conhecido.
    if (num && parts[0] !== num) return num;
    return t;
  }
  const fk = num || parts[0]!;
  if (parts[0] !== fk) return t;
  if (parts.length === 2) return fk;
  return [fk, ...parts.slice(2)].join(' - ');
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
    cardProcessoStepOneId?: string | null;
    cardProjetoId?: string | null;
    redeFranqueadoId?: string | null;
    cardTitulo?: string | null;
  },
): Promise<string | null> {
  const processoStepOneId = String(params.cardProcessoStepOneId ?? '').trim();
  if (processoStepOneId) {
    const { data: byCol } = await db
      .from('processo_step_one')
      .select('id')
      .eq('id', processoStepOneId)
      .maybeSingle();
    if (byCol?.id) return String(byCol.id);
  }

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

/**
 * Resolve processo só por FK explícita (`processo_step_one_id`, `projeto_id`, shadow id).
 * Usado no grupo de sync — evita agrupar cards distintos via rede/FK0000 heurístico.
 */
async function resolverProcessoIdExplicitoDoCard(db: SyncDb, cardId: string): Promise<string | null> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return null;

  const { data: card } = await db
    .from('kanban_cards')
    .select('projeto_id, processo_step_one_id')
    .eq('id', cid)
    .maybeSingle();
  const row = card as {
    projeto_id?: string | null;
    processo_step_one_id?: string | null;
  } | null;

  const processoStepOneId = String(row?.processo_step_one_id ?? '').trim();
  if (processoStepOneId) {
    const { data: byCol } = await db
      .from('processo_step_one')
      .select('id')
      .eq('id', processoStepOneId)
      .maybeSingle();
    if (byCol?.id) return String(byCol.id);
    // FK órfã: não inferir processo por projeto/rede (evita espelhar cards distintos).
    return null;
  }

  const projetoId = String(row?.projeto_id ?? '').trim();
  if (projetoId) {
    const { data: byProjeto } = await db.from('processo_step_one').select('id').eq('id', projetoId).maybeSingle();
    if (byProjeto?.id) return String(byProjeto.id);
  }

  const { data: proc } = await db.from('processo_step_one').select('id').eq('id', cid).maybeSingle();
  return proc?.id ? String(proc.id) : null;
}

/**
 * Propagação cross-funil só entre pai/filho direto (`origem_card_id`).
 * Evita espelhar título/franqueado em cards de outro funil ligados só por vínculo/processo.
 */
async function filtrarTargetsPropagacaoKanban(
  db: SyncDb,
  origemId: string,
  cardIds: string[],
): Promise<string[]> {
  if (cardIds.length <= 1) return cardIds;

  const { data: origemRow } = await db
    .from('kanban_cards')
    .select('kanban_id, origem_card_id')
    .eq('id', origemId)
    .maybeSingle();
  const origemKanban = String(
    (origemRow as { kanban_id?: string | null } | null)?.kanban_id ?? '',
  ).trim();
  const origemPaiId = String(
    (origemRow as { origem_card_id?: string | null } | null)?.origem_card_id ?? '',
  ).trim();

  const { data: rows } = await db
    .from('kanban_cards')
    .select('id, kanban_id, origem_card_id')
    .in('id', cardIds);

  const out: string[] = [];
  for (const row of rows ?? []) {
    const id = String((row as { id?: string }).id ?? '').trim();
    if (!id) continue;
    if (id === origemId) {
      out.push(id);
      continue;
    }
    const kanban = String((row as { kanban_id?: string | null }).kanban_id ?? '').trim();
    if (kanban && kanban === origemKanban) {
      out.push(id);
      continue;
    }
    const pai = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
    if (pai === origemId || origemPaiId === id) {
      out.push(id);
    }
  }

  return out.length > 0 ? out : [origemId];
}

/** Resolve `processo_step_one.id` a partir do card kanban (sem importar módulo server-only). */
async function resolverProcessoIdDoCard(db: SyncDb, cardId: string): Promise<string | null> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return null;

  const explicito = await resolverProcessoIdExplicitoDoCard(db, cid);
  if (explicito) return explicito;

  const { data: card } = await db
    .from('kanban_cards')
    .select('projeto_id, processo_step_one_id, rede_franqueado_id, titulo')
    .eq('id', cid)
    .maybeSingle();
  const row = card as {
    projeto_id?: string | null;
    processo_step_one_id?: string | null;
    rede_franqueado_id?: string | null;
    titulo?: string | null;
  } | null;

  return resolverProcessoStepOneIdDoCard(db, {
    cardProcessoStepOneId: row?.processo_step_one_id,
    cardProjetoId: row?.projeto_id,
    redeFranqueadoId: row?.rede_franqueado_id,
    cardTitulo: row?.titulo,
  });
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
  'hora_reuniao',
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
  'link_mapa_competidores',
  'link_apresentacao_comite',
  'anexo_opcao_permuta_path',
  'anexo_contrato_permuta_path',
  'anexo_seguro_garantia_path',
  'link_opcao_permuta',
  'link_contrato_permuta',
  'link_seguro_garantia',
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
  'prazo_opcao_dias',
  'prazo_opcao_sla_tipo',
  'prazo_opcao_modo',
  'prazo_opcao_fase_id',
  'prazo_opcao_data',
  'prazo_instrumento_garantidor_dias',
  'prazo_instrumento_garantidor_sla_tipo',
  'prazo_instrumento_garantidor_modo',
  'prazo_instrumento_garantidor_fase_id',
  'prazo_instrumento_garantidor_data',
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
  'data_reuniao',
  'hora_reuniao',
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
    const pid = await resolverProcessoIdExplicitoDoCard(db, cid);
    if (pid) processoIds.add(pid);
  }

  for (const pid of processoIds) {
    ids.add(pid);

    const { data: porProcesso } = await db
      .from('kanban_cards')
      .select('id')
      .or(
        `id.eq.${pid},processo_step_one_id.eq.${pid},and(projeto_id.eq.${pid},processo_step_one_id.is.null)`,
      );

    for (const row of porProcesso ?? []) {
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

/** Apenas ids de linhas reais em `kanban_cards` (exclui shadow `processo_step_one.id`). */
export async function listarKanbanCardIdsSyncGroup(db: SyncDb, startCardId: string): Promise<string[]> {
  const cid = String(startCardId ?? '').trim();
  if (!cid) return [];

  const ids = await listarCardIdsSyncGroup(db, cid);
  if (ids.length === 0) return [cid];

  const { data: rows, error } = await db.from('kanban_cards').select('id').in('id', ids);
  if (error) {
    console.error('[listarKanbanCardIdsSyncGroup]', error.message);
    return [cid];
  }

  const out = (rows ?? [])
    .map((r) => String((r as { id?: string }).id ?? '').trim())
    .filter(Boolean);
  return out.length > 0 ? out : [cid];
}

export async function contarOutrosCardsSyncGroup(db: SyncDb, cardId: string): Promise<number> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return 0;

  const ids = await listarCardIdsSyncGroup(db, cid);
  const outros = ids.filter((id) => id !== cid);
  if (outros.length === 0) return 0;

  // Só cards kanban reais — o grupo inclui `processo_step_one.id` (shadow) para sync de dados,
  // mas isso não é um card em outro funil e não deve aparecer no aviso da UI.
  const { data: rows } = await db.from('kanban_cards').select('id').in('id', outros);
  return (rows ?? []).length;
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

/** Prefere o título mais completo (FK + condomínio + quadra + lote). */
export function escolherTituloExibicaoCard(
  tituloAtual: string | null | undefined,
  tituloCalculado: string | null | undefined,
  nFranquia?: string | null,
): string {
  const calc = String(tituloCalculado ?? '').trim();
  const atual = tituloFallbackSemFranqueado(String(tituloAtual ?? ''), nFranquia);
  const partes = (t: string) => t.split(' - ').map((p) => p.trim()).filter(Boolean).length;
  if (atual && calc && partes(atual) > partes(calc)) return atual;
  if (calc) return calc;
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
  options?: { skipProcessoMirror?: boolean; actorUserId?: string | null },
): Promise<{ ok: true; atualizados: number } | { ok: false; error: string }> {
  const origem = String(cardOrigemId ?? '').trim();
  if (!origem) return { ok: false, error: 'Card inválido.' };

  const syncPatch = pickSyncFields(patch as Record<string, unknown>, KANBAN_CARD_CAMPOS_SYNC);
  if (Object.keys(syncPatch).length === 0) return { ok: true, atualizados: 0 };

  const cardIds = await filtrarTargetsPropagacaoKanban(
    db,
    origem,
    await listarCardIdsSyncGroup(db, origem),
  );
  let atualizados = 0;

  const precisaTitulo =
    syncPatch.titulo !== undefined ||
    syncPatch.rede_franqueado_id !== undefined ||
    syncPatch.nome_condominio !== undefined ||
    syncPatch.condominio_id !== undefined ||
    syncPatch.quadra !== undefined ||
    syncPatch.lote !== undefined;

  let tituloCanonico: string | null | undefined =
    syncPatch.titulo !== undefined ? syncPatch.titulo : undefined;

  let isFunilLoteadores = false;
  if (precisaTitulo && tituloCanonico === undefined) {
    const { data: origemRow } = await db
      .from('kanban_cards')
      .select('kanban_id, rede_franqueado_id, nome_condominio, quadra, lote, titulo')
      .eq('id', origem)
      .maybeSingle();
    const o = origemRow as {
      kanban_id?: string | null;
      rede_franqueado_id?: string | null;
      nome_condominio?: string | null;
      quadra?: string | null;
      lote?: string | null;
      titulo?: string | null;
    } | null;

    isFunilLoteadores = isKanbanFunilLoteadoresRef(o?.kanban_id);
    if (!isFunilLoteadores) {
      tituloCanonico = await resolverTituloCardKanban(db, {
        rede_franqueado_id: syncPatch.rede_franqueado_id ?? o?.rede_franqueado_id,
        nome_condominio: syncPatch.nome_condominio ?? o?.nome_condominio,
        quadra: syncPatch.quadra ?? o?.quadra,
        lote: syncPatch.lote ?? o?.lote,
        titulo: o?.titulo,
      });
    }
  }

  for (const targetId of cardIds) {
    const rowPatch = omitNullStickyKanbanFields({ ...syncPatch });

    if (tituloCanonico && rowPatch.titulo === undefined) {
      rowPatch.titulo = tituloCanonico;
    }

    if (Object.keys(rowPatch).length === 0) continue;

    const applyUpdate = async () => {
      const { error } = await db.from('kanban_cards').update(rowPatch as never).eq('id', targetId);
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const };
    };

    const result = options?.actorUserId
      ? await withKanbanHistoricoActor(db, options.actorUserId, applyUpdate)
      : await applyUpdate();
    if (!result.ok) return result;
    atualizados++;
  }

  if (isFunilLoteadores && precisaTitulo) {
    for (const targetId of cardIds) {
      const syncTitulo = await sincronizarTituloCardLoteadores(db, targetId, {
        nomeCondominio: syncPatch.nome_condominio,
        quadra: syncPatch.quadra,
        lote: syncPatch.lote,
      });
      if (!syncTitulo.ok) return syncTitulo;
    }
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
  options?: { actorUserId?: string | null },
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
    const sync = await propagarCamposKanbanCards(db, origem, kanbanMirror, {
      skipProcessoMirror: true,
      actorUserId: options?.actorUserId,
    });
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
  'hora_reuniao',
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
    const nFq =
      out.rede_franqueado_id != null
        ? await nFranquiaDeRede(db, out.rede_franqueado_id)
        : extrairNumeroFranquiaDoTitulo(String(out.titulo ?? '')) || null;
    out.titulo = escolherTituloExibicaoCard(out.titulo, tituloRecalc, nFq);
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

/** Campos de `kanban_cards` replicados do pai para filho de bastão (calculadora global). */
export const KANBAN_CARD_CAMPOS_BASTAO_CALCULADORA = [
  'processo_step_one_id',
  'projeto_id',
  'opcao_assinada',
  'opcao_assinada_em',
  'comite_aprovado',
  'comite_aprovado_em',
  'contrato_assinado',
  'contrato_assinado_em',
  'obra_iniciada',
  'obra_iniciada_em',
  'obra_finalizada',
  'obra_finalizada_em',
  'prefeitura_aprovada',
  'prefeitura_aprovada_em',
] as const;

const BASTAO_CALCULADORA_ANTI_NULL = new Set<string>([
  'processo_step_one_id',
  'projeto_id',
  'opcao_assinada_em',
  'comite_aprovado_em',
  'contrato_assinado_em',
  'obra_iniciada_em',
  'obra_finalizada_em',
  'prefeitura_aprovada_em',
]);

function coalesceBooleanMarco(atual: unknown, candidato: unknown): boolean | undefined {
  if (candidato === true) return true;
  if (atual === true) return true;
  if (candidato === false) return false;
  if (atual === false) return false;
  return undefined;
}

function coalesceTextoMarco(atual: unknown, candidato: unknown): string | null | undefined {
  const c = String(candidato ?? '').trim();
  if (c) return c;
  const a = String(atual ?? '').trim();
  return a || undefined;
}

/** Sobe `origem_card_id` e retorna ids do mais novo ao mais antigo (filho → raiz). */
async function listarCadeiaOrigemCardIds(db: SyncDb, startCardId: string): Promise<string[]> {
  const ids: string[] = [];
  let cur = String(startCardId ?? '').trim();
  for (let depth = 0; depth < 32 && cur; depth++) {
    ids.push(cur);
    const { data: row } = await db
      .from('kanban_cards')
      .select('origem_card_id')
      .eq('id', cur)
      .maybeSingle();
    const pai = String((row as { origem_card_id?: string | null } | null)?.origem_card_id ?? '').trim();
    if (!pai || ids.includes(pai)) break;
    cur = pai;
  }
  return ids;
}

/** Coalesce marcos/processo/projeto da cadeia `origem_card_id` (filho → raiz). */
async function resolverCamposCalculadoraCanonicosCadeia(
  db: SyncDb,
  cardPaiId: string,
): Promise<Record<string, unknown>> {
  const chainIds = await listarCadeiaOrigemCardIds(db, cardPaiId);
  if (chainIds.length === 0) return {};

  const selectCols = ['id', 'created_at', 'titulo', 'rede_franqueado_id', ...KANBAN_CARD_CAMPOS_BASTAO_CALCULADORA].join(
    ', ',
  );

  const { data: rows, error } = await db
    .from('kanban_cards')
    .select(selectCols)
    .in('id', chainIds);
  if (error) throw new Error(error.message);

  const byId = new Map<string, Record<string, unknown>>();
  for (const row of (rows ?? []) as unknown as Record<string, unknown>[]) {
    const id = String(row.id ?? '').trim();
    if (id) byId.set(id, row);
  }

  const merged: Record<string, unknown> = {};
  let createdAtCanonico: string | null = null;
  let redeFranqueadoId: string | null = null;

  for (const cid of [...chainIds].reverse()) {
    const row = byId.get(cid);
    if (!row) continue;

    const rowCreated = String(row.created_at ?? '').trim();
    if (rowCreated && (!createdAtCanonico || new Date(rowCreated) < new Date(createdAtCanonico))) {
      createdAtCanonico = rowCreated;
    }

    const redeRow = String(row.rede_franqueado_id ?? '').trim();
    if (redeRow) redeFranqueadoId = redeRow;

    for (const k of KANBAN_CARD_CAMPOS_BASTAO_CALCULADORA) {
      const val = row[k];
      if (k.endsWith('_em')) {
        const coalesced = coalesceTextoMarco(merged[k], val);
        if (coalesced !== undefined) merged[k] = coalesced;
      } else if (typeof val === 'boolean' || val === null) {
        const coalesced = coalesceBooleanMarco(merged[k], val);
        if (coalesced !== undefined) merged[k] = coalesced;
      } else {
        const coalesced = coalesceTextoMarco(merged[k], val);
        if (coalesced !== undefined) merged[k] = coalesced;
      }
    }
  }

  if (createdAtCanonico) merged.created_at = createdAtCanonico;

  const procResolvido = await resolverProcessoStepOneIdDoCard(db, {
    cardProcessoStepOneId: merged.processo_step_one_id as string | null | undefined,
    cardProjetoId: merged.projeto_id as string | null | undefined,
    redeFranqueadoId,
    cardTitulo: String(byId.get(chainIds[0]!)?.titulo ?? '').trim() || null,
  });
  if (procResolvido) merged.processo_step_one_id = procResolvido;

  return merged;
}

export type MarcosCanonicosCalculadora = {
  contrato_assinado_em: string | null;
  obra_iniciada_em: string | null;
  obra_finalizada_em: string | null;
  opcao_assinada_em: string | null;
  concluido_em: string | null;
};

export type ContextoCalculadoraSyncGroup = {
  createdAtCanonico: string | null;
  marcosCanonicos: MarcosCanonicosCalculadora;
  condominioIdCanonico: string | null;
  kanbanIdCanonico: string;
  faseIdCanonico: string;
  faseSlugCanonico: string | null;
  cardCalcCanonico: {
    fase_id: string;
    created_at: string;
    entered_fase_at: string | null;
    concluido: boolean;
    concluido_em: string | null;
  };
};

function mergeCamposCalculadoraRows(rows: Record<string, unknown>[]): {
  merged: Record<string, unknown>;
  createdAtCanonico: string | null;
} {
  const merged: Record<string, unknown> = {};
  let createdAtCanonico: string | null = null;

  for (const row of rows) {
    const rowCreated = String(row.created_at ?? '').trim();
    if (rowCreated && (!createdAtCanonico || new Date(rowCreated) < new Date(createdAtCanonico))) {
      createdAtCanonico = rowCreated;
    }

    for (const k of KANBAN_CARD_CAMPOS_BASTAO_CALCULADORA) {
      const val = row[k];
      if (k.endsWith('_em')) {
        const coalesced = coalesceTextoMarco(merged[k], val);
        if (coalesced !== undefined) merged[k] = coalesced;
      } else if (typeof val === 'boolean' || val === null) {
        const coalesced = coalesceBooleanMarco(merged[k], val);
        if (coalesced !== undefined) merged[k] = coalesced;
      } else {
        const coalesced = coalesceTextoMarco(merged[k], val);
        if (coalesced !== undefined) merged[k] = coalesced;
      }
    }

    const concluidoEm = coalesceTextoMarco(merged.concluido_em, row.concluido_em);
    if (concluidoEm !== undefined) merged.concluido_em = concluidoEm;
  }

  if (createdAtCanonico) merged.created_at = createdAtCanonico;
  return { merged, createdAtCanonico };
}

function marcosCanonicosFromMerged(merged: Record<string, unknown>): MarcosCanonicosCalculadora {
  const pick = (k: string): string | null => {
    const v = merged[k];
    if (v == null || String(v).trim() === '') return null;
    return String(v).trim();
  };
  return {
    contrato_assinado_em: pick('contrato_assinado_em'),
    obra_iniciada_em: pick('obra_iniciada_em'),
    obra_finalizada_em: pick('obra_finalizada_em'),
    opcao_assinada_em: pick('opcao_assinada_em'),
    concluido_em: pick('concluido_em'),
  };
}

/** Contexto canônico da calculadora global para todo o grupo de sync. */
export async function fetchContextoCalculadoraSyncGroup(
  db: SyncDb,
  cardId: string,
): Promise<ContextoCalculadoraSyncGroup | null> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return null;

  const kanbanCardIds = await listarKanbanCardIdsSyncGroup(db, cid);
  if (kanbanCardIds.length === 0) return null;

  const selectCols = [
    'id',
    'kanban_id',
    'fase_id',
    'created_at',
    'entered_fase_at',
    'concluido',
    'concluido_em',
    'titulo',
    'rede_franqueado_id',
    'condominio_id',
    ...KANBAN_CARD_CAMPOS_BASTAO_CALCULADORA,
  ].join(', ');

  const { data: rows, error } = await db
    .from('kanban_cards')
    .select(selectCols)
    .in('id', kanbanCardIds);
  if (error || !rows?.length) {
    if (error) console.error('[fetchContextoCalculadoraSyncGroup]', error.message);
    return null;
  }

  const typedRows = rows as unknown as Record<string, unknown>[];
  const { merged, createdAtCanonico } = mergeCamposCalculadoraRows(typedRows);
  const marcosCanonicos = marcosCanonicosFromMerged(merged);

  const esteiraRows = typedRows.filter((r) =>
    cardKanbanNaEsteiraPrincipalCalculadora(String(r.kanban_id ?? '')),
  );
  const candidatos = esteiraRows.length > 0 ? esteiraRows : typedRows;

  const faseIds = [
    ...new Set(candidatos.map((r) => String(r.fase_id ?? '').trim()).filter(Boolean)),
  ];
  const ordemPorFase = new Map<string, number>();
  if (faseIds.length > 0) {
    const { data: faseRows } = await db
      .from('kanban_fases')
      .select('id, ordem')
      .in('id', faseIds);
    for (const fr of faseRows ?? []) {
      const fid = String((fr as { id?: string }).id ?? '').trim();
      const ordem = Number((fr as { ordem?: number }).ordem ?? 0);
      if (fid) ordemPorFase.set(fid, ordem);
    }
  }

  let cardAvancado = candidatos[0]!;
  let maxSegmento = -1;
  let maxOrdemFase = -1;

  for (const row of candidatos) {
    const kid = String(row.kanban_id ?? '').trim();
    const fid = String(row.fase_id ?? '').trim();
    const segmento = segmentoEsteiraCardCalculadora(kid);
    const ordemFase = ordemPorFase.get(fid) ?? 0;

    if (
      segmento > maxSegmento ||
      (segmento === maxSegmento && ordemFase > maxOrdemFase)
    ) {
      maxSegmento = segmento;
      maxOrdemFase = ordemFase;
      cardAvancado = row;
    }
  }

  const kanbanIdCanonico = String(cardAvancado.kanban_id ?? '').trim();
  const faseIdCanonico = String(cardAvancado.fase_id ?? '').trim();
  if (!kanbanIdCanonico || !faseIdCanonico) return null;

  let faseSlugCanonico: string | null = null;
  const { data: faseRow } = await db
    .from('kanban_fases')
    .select('slug')
    .eq('id', faseIdCanonico)
    .maybeSingle();
  faseSlugCanonico = String((faseRow as { slug?: string | null } | null)?.slug ?? '').trim() || null;

  const createdAt =
    (createdAtCanonico ?? String(cardAvancado.created_at ?? '').trim()) ||
    new Date().toISOString();

  let condominioIdCanonico: string | null | undefined = undefined;
  let redeFranqueadoIdCanonico: string | null | undefined = undefined;
  for (const row of typedRows) {
    condominioIdCanonico = coalesceTextoMarco(condominioIdCanonico, row.condominio_id);
    redeFranqueadoIdCanonico = coalesceTextoMarco(redeFranqueadoIdCanonico, row.rede_franqueado_id);
  }

  let condominioIdResolvido = condominioIdCanonico ?? null;
  if (!condominioIdResolvido) {
    const procId = await resolverProcessoStepOneIdDoCard(db, {
      cardProcessoStepOneId: merged.processo_step_one_id as string | null | undefined,
      cardProjetoId: merged.projeto_id as string | null | undefined,
      redeFranqueadoId: redeFranqueadoIdCanonico ?? null,
      cardTitulo: String(cardAvancado.titulo ?? '').trim() || null,
    });
    if (procId) {
      const { data: proc } = await db
        .from('processo_step_one')
        .select('condominio_id')
        .eq('id', procId)
        .maybeSingle();
      condominioIdResolvido =
        String((proc as { condominio_id?: string | null } | null)?.condominio_id ?? '').trim() || null;
    }
  }

  return {
    createdAtCanonico: createdAt,
    marcosCanonicos,
    condominioIdCanonico: condominioIdResolvido,
    kanbanIdCanonico,
    faseIdCanonico,
    faseSlugCanonico,
    cardCalcCanonico: {
      fase_id: faseIdCanonico,
      created_at: createdAt,
      entered_fase_at:
        cardAvancado.entered_fase_at != null ? String(cardAvancado.entered_fase_at) : null,
      concluido: cardAvancado.concluido === true,
      concluido_em:
        cardAvancado.concluido_em != null ? String(cardAvancado.concluido_em) : null,
    },
  };
}

async function espelharHistoricoCalculadoraCadeiaPai(
  db: SyncDb,
  cardFilhoId: string,
  cardPaiId: string,
  faseDestinoId: string,
  faseDestinoSlug: string,
  actorUserId?: string | null,
): Promise<void> {
  const filhoId = String(cardFilhoId ?? '').trim();
  const paiId = String(cardPaiId ?? '').trim();
  if (!filhoId || !paiId) return;

  const { data: existenteMov } = await db
    .from('kanban_historico')
    .select('id')
    .eq('card_id', filhoId)
    .in('acao', ['fase_avancada', 'fase_retrocedida'])
    .limit(1);
  if ((existenteMov ?? []).length > 0) return;

  const chainIds = (await listarCadeiaOrigemCardIds(db, paiId)).filter((id) => id !== filhoId);
  if (chainIds.length === 0) return;

  const { data: rows, error } = await db
    .from('kanban_historico')
    .select('acao, tipo, usuario_id, usuario_nome, detalhe, criado_em')
    .in('card_id', chainIds)
    .in('acao', ['fase_avancada', 'fase_retrocedida'])
    .order('criado_em', { ascending: true });
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const inserts: Record<string, unknown>[] = [];
  for (const row of rows ?? []) {
    const det = (row as { detalhe?: Record<string, unknown> | null }).detalhe ?? null;
    const ant = String(det?.fase_anterior_id ?? '').trim();
    const nov = String(det?.fase_nova_id ?? '').trim();
    const criado = String((row as { criado_em?: string }).criado_em ?? '').trim();
    const acao = String((row as { acao?: string }).acao ?? '').trim();
    const tipoRaw = String((row as { tipo?: string | null }).tipo ?? '').trim();
    const tipo = tipoRaw || tipoKanbanHistoricoFromAcao(acao);
    const key = `${criado}|${acao}|${ant}|${nov}`;
    if (!criado || seen.has(key)) continue;
    seen.add(key);
    inserts.push({
      card_id: filhoId,
      acao,
      tipo,
      usuario_id: (row as { usuario_id?: string | null }).usuario_id ?? null,
      usuario_nome: (row as { usuario_nome?: string | null }).usuario_nome ?? null,
      detalhe: det,
      criado_em: criado,
    });
  }

  if (inserts.length > 0) {
    const { error: insErr } = await db.from('kanban_historico').insert(inserts as never);
    if (insErr) throw new Error(insErr.message);
  }

  const { data: jaCriado } = await db
    .from('kanban_historico')
    .select('id')
    .eq('card_id', filhoId)
    .eq('acao', 'card_criado')
    .limit(1);
  if (!(jaCriado ?? []).length) {
    const now = new Date().toISOString();
    let usuarioId = String(actorUserId ?? '').trim() || null;
    if (!usuarioId) {
      const { data: filhoRow } = await db
        .from('kanban_cards')
        .select('franqueado_id')
        .eq('id', filhoId)
        .maybeSingle();
      usuarioId = String((filhoRow as { franqueado_id?: string | null } | null)?.franqueado_id ?? '').trim() || null;
    }
    const usuarioNome = await resolveUsuarioNomeHistorico(db, usuarioId);
    const { error: criadoErr } = await db.from('kanban_historico').insert({
      card_id: filhoId,
      acao: 'card_criado',
      tipo: tipoKanbanHistoricoFromAcao('card_criado'),
      usuario_id: usuarioId,
      usuario_nome: usuarioNome,
      detalhe: { fase_id: faseDestinoId, fase_slug: faseDestinoSlug },
      criado_em: now,
    } as never);
    if (criadoErr) throw new Error(criadoErr.message);
  }
}

async function espelharDatasManuaisCalculadoraDoPai(
  db: SyncDb,
  cardPaiId: string,
  cardFilhoId: string,
): Promise<void> {
  const paiId = String(cardPaiId ?? '').trim();
  const filhoId = String(cardFilhoId ?? '').trim();
  if (!paiId || !filhoId || paiId === filhoId) return;

  const { data: paiRows, error: errPai } = await db
    .from('kanban_calculadora_fase_datas')
    .select('fase_id, data_inicio, data_fim, editado_por, editado_em')
    .eq('card_id', paiId);
  if (errPai) throw new Error(errPai.message);
  if (!(paiRows ?? []).length) return;

  const { data: filhoRows } = await db
    .from('kanban_calculadora_fase_datas')
    .select('fase_id')
    .eq('card_id', filhoId);
  const fasesFilho = new Set(
    (filhoRows ?? []).map((r) => String((r as { fase_id?: string }).fase_id ?? '').trim()).filter(Boolean),
  );

  const inserts: Record<string, unknown>[] = [];
  for (const row of paiRows ?? []) {
    const faseId = String((row as { fase_id?: string }).fase_id ?? '').trim();
    if (!faseId || fasesFilho.has(faseId)) continue;
    inserts.push({
      card_id: filhoId,
      fase_id: faseId,
      data_inicio: (row as { data_inicio?: string | null }).data_inicio ?? null,
      data_fim: (row as { data_fim?: string | null }).data_fim ?? null,
      editado_por: (row as { editado_por?: string | null }).editado_por ?? null,
      editado_em: (row as { editado_em?: string | null }).editado_em ?? new Date().toISOString(),
    });
  }

  if (inserts.length === 0) return;
  const { error: insErr } = await db
    .from('kanban_calculadora_fase_datas')
    .upsert(inserts as never, { onConflict: 'card_id,fase_id', ignoreDuplicates: true });
  if (insErr) throw new Error(insErr.message);
}

/**
 * Replica campos da calculadora global do pai (e cadeia `origem_card_id`) para card filho de bastão.
 * Idempotente — não apaga dados existentes no filho (coalesce).
 */
export async function sincronizarCamposCalculadoraBastaoFilho(
  db: SyncDb,
  cardPaiId: string,
  cardFilhoId: string,
  options?: { faseDestinoId?: string; faseDestinoSlug?: string; actorUserId?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const paiId = String(cardPaiId ?? '').trim();
  const filhoId = String(cardFilhoId ?? '').trim();
  if (!paiId || !filhoId) return { ok: false, error: 'Card pai ou filho inválido.' };

  try {
    const canon = await resolverCamposCalculadoraCanonicosCadeia(db, paiId);
    const patch: Record<string, unknown> = {};

    for (const k of KANBAN_CARD_CAMPOS_BASTAO_CALCULADORA) {
      if (!Object.prototype.hasOwnProperty.call(canon, k)) continue;
      const v = canon[k];
      if (BASTAO_CALCULADORA_ANTI_NULL.has(k) && (v == null || String(v).trim() === '')) continue;
      patch[k] = v;
    }

    const createdAt = String(canon.created_at ?? '').trim();
    if (createdAt) patch.created_at = createdAt;

    if (Object.keys(patch).length > 0) {
      const applyUpdate = async () => {
        const { error: updErr } = await db.from('kanban_cards').update(patch as never).eq('id', filhoId);
        if (updErr) return { ok: false as const, error: updErr.message };
        return { ok: true as const };
      };
      const upd = options?.actorUserId
        ? await withKanbanHistoricoActor(db, options.actorUserId, applyUpdate)
        : await applyUpdate();
      if (!upd.ok) return upd;
    }

    const faseDestinoId = String(options?.faseDestinoId ?? '').trim();
    const faseDestinoSlug = String(options?.faseDestinoSlug ?? '').trim();
    if (faseDestinoId && faseDestinoSlug) {
      await espelharHistoricoCalculadoraCadeiaPai(
        db,
        filhoId,
        paiId,
        faseDestinoId,
        faseDestinoSlug,
        options?.actorUserId,
      );
    }

    await espelharDatasManuaisCalculadoraDoPai(db, paiId, filhoId);

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
