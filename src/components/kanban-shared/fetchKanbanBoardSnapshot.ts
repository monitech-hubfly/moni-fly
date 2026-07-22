import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAccessRole } from '@/lib/authz';
import { KANBAN_ID_BY_NOME, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { KANBAN_NOME_FUNIL_LOTEADORES } from '@/lib/kanban/funil-loteadores';
import { prepareStepOneBoardSnapshot } from '@/lib/kanban/stepone-fase-slugs';
import {
  augmentKanbanFasesComFasesDosCards,
  fetchKanbanFasesAtivas,
} from '@/lib/kanban/fetch-kanban-fases';
import { enrichCardsParalelasContext } from '@/lib/kanban/kanban-paralelas-chips';
import { enrichCardsComResponsavelFase } from '@/lib/kanban/responsavel-fase-checklist';
import {
  aplicarFasePorEtapaPainelEmLote,
  buildSlugParaFaseIdMap,
  coletarIdsProcessoDosCards,
  fetchEtapaPainelPorProcessoIds,
} from '@/lib/kanban/reconciliar-fase-etapa-painel';
import {
  montarTituloCardSync,
  escolherTituloExibicaoCard,
  extrairNumeroFranquiaDoTitulo,
  parseCamposDoTituloCard,
} from '@/lib/kanban/card-sync-group';
import {
  isKanbanFunilLoteadoresRef,
  montarTituloCardLoteadores,
  subtituloCardLoteadores,
} from '@/lib/kanban/loteadores-card-titulo';
import {
  runKanbanCardSelectWithSlaFallback,
} from '@/lib/kanban/kanban-card-select-cols';
import { dataIsoInputValida } from '@/lib/kanban/kanban-card-datas';
import type { KanbanCardBrief, KanbanFase } from './types';

/**
 * `lean` (default): só cards ativos — arquivados/concluídos sob demanda no board.
 * `full`: comportamento legado (3 queries nativas + pools completos).
 * `arquivados` / `concluidos`: carrega só o pool pedido (lazy STATUS).
 */
export type KanbanBoardSnapshotMode = 'lean' | 'full' | 'arquivados' | 'concluidos';

export type FetchKanbanBoardSnapshotOptions = {
  mode?: KanbanBoardSnapshotMode;
};

export type KanbanBoardSnapshot = {
  kanban: { id: string } | null;
  fases: KanbanFase[];
  /**
   * Lean/full ativos: cards ativos (+ arquivados se `full` ou mode `arquivados`).
   * Concluídos ficam em `cardsConcluidos`.
   */
  cards: KanbanCardBrief[];
  /** Nativo: cards finalizados (filtro STATUS “Concluídos”). Legado: []. */
  cardsConcluidos: KanbanCardBrief[];
  role: string;
  isAdmin: boolean;
  /** Modo efetivo do fetch (útil para o client saber se precisa lazy-load). */
  snapshotMode: KanbanBoardSnapshotMode;
};

/** Funis 100% nativos: no path lean não carrega `v_processo_como_kanban_cards`. */
const KANBANS_SEMPRE_NATIVOS = new Set([
  'Funil Step One',
  'Funil Portfólio',
  'Funil Loteadores',
  'Funil Acoplamento',
  'Funil MonINC',
]);

/**
 * Híbridos: ainda usam a view no lean para preencher lacunas sem linha em `kanban_cards`.
 * Se algum desses quebrar após migração total para nativo, pode sair desta lista.
 */
const KANBANS_HIBRIDOS_COM_VIEW_LEGADO = new Set([
  'Funil Operações',
  'Funil Contabilidade',
  'Funil Cash Me',
  'Funil Crédito Obra',
  'Funil Crédito',
]);

function resolveSnapshotMode(options?: FetchKanbanBoardSnapshotOptions): KanbanBoardSnapshotMode {
  if (options?.mode) return options.mode;
  // Escape hatch: forçar snapshot completo sem alterar call sites.
  if (process.env.KANBAN_BOARD_SNAPSHOT_FULL === '1') return 'full';
  return 'lean';
}

type ViewLegadoRow = {
  id: string;
  kanban_id: string;
  fase_id: string;
  titulo: string;
  status: string;
  criado_em: string;
  responsavel_id: string | null;
  etapa_slug: string | null;
  origem: string | null;
  data_reuniao?: string | null;
  data_followup?: string | null;
};

function dataIsoParaInput(v: unknown): string | null {
  if (v == null || v === '') return null;
  const s = String(v).slice(0, 10);
  return dataIsoInputValida(s) ? s : null;
}

/** Preenche datas ausentes no card nativo a partir do legado (view processo) ou processo_step_one. */
function coalesceDatasCardBrief(
  card: KanbanCardBrief,
  legado?: KanbanCardBrief | null,
  processo?: { data_followup?: unknown; data_reuniao?: unknown } | null,
): KanbanCardBrief {
  const dr =
    card.data_reuniao ??
    legado?.data_reuniao ??
    (processo ? dataIsoParaInput(processo.data_reuniao) : null);
  if (dr === card.data_reuniao) return card;
  return { ...card, data_reuniao: dr ?? null };
}

async function enrichCardsDatasFromProcesso(
  supabase: SupabaseClient,
  cards: KanbanCardBrief[],
): Promise<KanbanCardBrief[]> {
  const processoIds = new Set<string>();
  for (const c of cards) {
    if (c.data_reuniao) continue;
    const id = String(c.id ?? '').trim();
    if (id) processoIds.add(id);
    const pid = String(c.projeto_id ?? '').trim();
    if (pid) processoIds.add(pid);
  }
  const ids = [...processoIds];
  if (ids.length === 0) return cards;

  const { data } = await supabase
    .from('processo_step_one')
    .select('id, data_followup, data_reuniao')
    .in('id', ids);

  const byProcessoId = new Map<
    string,
    { data_followup?: unknown; data_reuniao?: unknown }
  >();
  for (const row of data ?? []) {
    const id = String((row as { id?: string }).id ?? '').trim();
    if (id) byProcessoId.set(id, row as { data_followup?: unknown; data_reuniao?: unknown });
  }

  return cards.map((c) => {
    const proc =
      byProcessoId.get(String(c.id ?? '').trim()) ??
      (c.projeto_id ? byProcessoId.get(String(c.projeto_id).trim()) : undefined);
    return coalesceDatasCardBrief(c, null, proc);
  });
}

type ProcessoCamposRow = {
  nome_condominio?: string | null;
  quadra?: string | null;
  lote?: string | null;
  quadra_lote?: string | null;
};

function coalesceTextoCampo(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return null;
}

async function fetchCamposAncestraisPorCard(
  supabase: SupabaseClient,
  cards: Array<Record<string, unknown>>,
): Promise<Map<string, Record<string, unknown>>> {
  type Row = Record<string, unknown>;
  const byId = new Map<string, Row>();

  for (const c of cards) {
    const id = String(c.id ?? '').trim();
    if (id) byId.set(id, c);
  }

  let frontier = [
    ...new Set(
      cards
        .map((c) => String((c as { origem_card_id?: string | null }).origem_card_id ?? '').trim())
        .filter((id) => id && !byId.has(id)),
    ),
  ];

  for (let depth = 0; depth < 32 && frontier.length > 0; depth++) {
    const { data } = await supabase
      .from('kanban_cards')
      .select('id, titulo, nome_condominio, quadra, lote, rede_franqueado_id, origem_card_id, data_followup, data_reuniao')
      .in('id', frontier);

    const next: string[] = [];
    for (const row of (data ?? []) as Row[]) {
      const id = String(row.id ?? '').trim();
      if (!id) continue;
      byId.set(id, row);
      const origem = String(row.origem_card_id ?? '').trim();
      if (origem && !byId.has(origem)) next.push(origem);
    }
    frontier = [...new Set(next)];
  }

  return byId;
}

function partesTituloCard(t: string): number {
  return t.split(' - ').map((p) => p.trim()).filter(Boolean).length;
}

function mesclarCamposDeFonte(
  dest: Record<string, unknown>,
  fonte: Record<string, unknown>,
): Record<string, unknown> {
  const tituloDest = String(dest.titulo ?? '').trim();
  const tituloFonte = String(fonte.titulo ?? '').trim();
  const parsedFonte = parseCamposDoTituloCard(tituloFonte);

  return {
    ...dest,
    titulo: partesTituloCard(tituloFonte) > partesTituloCard(tituloDest) ? tituloFonte : tituloDest,
    nome_condominio:
      coalesceTextoCampo(dest.nome_condominio, fonte.nome_condominio, parsedFonte.nomeCondominio) ??
      dest.nome_condominio,
    quadra:
      coalesceTextoCampo(dest.quadra, fonte.quadra, parsedFonte.quadra) ?? dest.quadra,
    lote: coalesceTextoCampo(dest.lote, fonte.lote, parsedFonte.lote) ?? dest.lote,
    rede_franqueado_id:
      coalesceTextoCampo(dest.rede_franqueado_id, fonte.rede_franqueado_id) ??
      dest.rede_franqueado_id,
    data_reuniao: dest.data_reuniao ?? fonte.data_reuniao,
  };
}

function mesclarCamposComAncestrais(
  card: Record<string, unknown>,
  byId: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  let merged: Record<string, unknown> = { ...card };
  let cur = String((card as { origem_card_id?: string | null }).origem_card_id ?? '').trim();

  for (let depth = 0; depth < 32 && cur; depth++) {
    const pai = byId.get(cur);
    if (!pai) break;
    merged = mesclarCamposDeFonte(merged, pai);
    cur = String(pai.origem_card_id ?? '').trim();
  }

  return merged;
}

function mesclarCamposComProjetoIrmaos(
  card: Record<string, unknown>,
  porProjeto: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  const pid = String((card as { projeto_id?: string | null }).projeto_id ?? '').trim();
  if (!pid) return card;
  const fonte = porProjeto.get(pid);
  if (!fonte) return card;
  return mesclarCamposDeFonte(card, fonte);
}

async function fetchCamposIrmaosPorProjeto(
  supabase: SupabaseClient,
  cards: Array<Record<string, unknown>>,
): Promise<Map<string, Record<string, unknown>>> {
  const projetoIds = [
    ...new Set(
      cards
        .map((c) => String((c as { projeto_id?: string | null }).projeto_id ?? '').trim())
        .filter(Boolean),
    ),
  ];
  const out = new Map<string, Record<string, unknown>>();
  if (projetoIds.length === 0) return out;

  const chunkSize = 100;
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < projetoIds.length; i += chunkSize) {
    const chunk = projetoIds.slice(i, i + chunkSize);
    const { data } = await supabase
      .from('kanban_cards')
      .select(
        'id, projeto_id, titulo, nome_condominio, quadra, lote, rede_franqueado_id, data_followup, data_reuniao',
      )
      .in('projeto_id', chunk);
    rows.push(...((data ?? []) as Record<string, unknown>[]));
  }

  for (const pid of projetoIds) {
    const siblings = rows.filter((r) => String(r.projeto_id ?? '').trim() === pid);
    let agg: Record<string, unknown> = {};
    for (const sib of siblings) {
      agg = mesclarCamposDeFonte(agg, sib);
    }
    if (Object.keys(agg).length > 0) out.set(pid, agg);
  }

  return out;
}

async function fetchProcessoCamposPorIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, ProcessoCamposRow>> {
  const out = new Map<string, ProcessoCamposRow>();
  const uniq = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (uniq.length === 0) return out;

  const chunkSize = 200;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    const { data } = await supabase
      .from('processo_step_one')
      .select('id, nome_condominio, quadra, lote, quadra_lote')
      .in('id', chunk);
    for (const row of data ?? []) {
      const id = String((row as { id?: string }).id ?? '').trim();
      if (id) out.set(id, row as ProcessoCamposRow);
    }
  }
  return out;
}

async function enrichCardsFollowupFromAtividades(
  supabase: SupabaseClient,
  cards: KanbanCardBrief[],
): Promise<KanbanCardBrief[]> {
  const cardIds = cards.filter((c) => !c.data_followup).map((c) => c.id).filter(Boolean);
  if (cardIds.length === 0) return cards;

  const { data } = await supabase
    .from('kanban_atividades')
    .select('card_id, data_vencimento, status')
    .in('card_id', cardIds)
    .not('data_vencimento', 'is', null);

  const maxPorCard = new Map<string, string>();
  for (const row of data ?? []) {
    const cid = String((row as { card_id?: string }).card_id ?? '').trim();
    const dv = dataIsoParaInput((row as { data_vencimento?: unknown }).data_vencimento);
    const status = String((row as { status?: string }).status ?? '').trim();
    if (!cid || !dv || status === 'concluida' || status === 'cancelada') continue;
    const atual = maxPorCard.get(cid);
    if (!atual || dv > atual) maxPorCard.set(cid, dv);
  }

  if (maxPorCard.size === 0) return cards;

  return cards.map((c) => {
    const df = maxPorCard.get(c.id);
    if (!df || c.data_followup) return c;
    return { ...c, data_followup: df };
  });
}

/** Resolve kanban ativo pelo UUID canônico (PROD) ou fallback em `kanbans.nome`. */
async function resolveKanbanAtivo(
  supabase: SupabaseClient,
  kanbanNomeDb: string,
): Promise<{ id: string } | null> {
  const canonicalId = KANBAN_ID_BY_NOME[kanbanNomeDb];
  if (canonicalId) {
    const { data } = await supabase
      .from('kanbans')
      .select('id')
      .eq('id', canonicalId)
      .eq('ativo', true)
      .maybeSingle();
    if (data?.id) return { id: String(data.id) };
  }

  const { data: kanbans } = await supabase
    .from('kanbans')
    .select('id')
    .eq('nome', kanbanNomeDb)
    .eq('ativo', true)
    .limit(1);

  const row = kanbans?.[0];
  return row?.id ? { id: String(row.id) } : null;
}

/**
 * Carrega fases e cards do kanban pelo nome (`kanbans.nome`).
 * Default `mode: 'lean'`: só ativos (`status=ativo`, não arquivado, não concluído).
 * Arquivados / concluídos: `mode: 'arquivados' | 'concluidos'` (lazy no board) ou `full`.
 * Sem `userId` (ex.: visitante com service role): não filtra por franqueado e assume visão ampla.
 *
 * Se não houver linhas em `kanban_cards` para o kanban, os cards vêm de
 * `v_processo_como_kanban_cards` (processo_step_one) com `origem: 'legado'`.
 * Híbridos Contabilidade/Cash Me mantêm a view no lean; demais nativos pulam a view.
 * Escape hatch: `mode: 'full'` ou env `KANBAN_BOARD_SNAPSHOT_FULL=1`.
 */
export async function fetchKanbanBoardSnapshot(
  supabase: SupabaseClient,
  kanbanNomeDb: string,
  userId: string | null,
  options?: FetchKanbanBoardSnapshotOptions,
): Promise<KanbanBoardSnapshot> {
  const snapshotMode = resolveSnapshotMode(options);
  const wantAtivos = snapshotMode === 'lean' || snapshotMode === 'full';
  const wantArquivados = snapshotMode === 'full' || snapshotMode === 'arquivados';
  const wantConcluidos = snapshotMode === 'full' || snapshotMode === 'concluidos';

  let role = 'frank';
  let isAdmin = false;

  const profilePromise = userId
    ? supabase.from('profiles').select('role').eq('id', userId).single()
    : Promise.resolve({ data: null as { role?: string | null } | null });

  const [profileRes, kanban] = await Promise.all([
    profilePromise,
    resolveKanbanAtivo(supabase, kanbanNomeDb),
  ]);

  let veTodosCards = false;
  if (userId) {
    const profile = profileRes.data;
    role = (profile?.role as string) ?? 'frank';
    const accessRole = normalizeAccessRole(profile?.role);
    isAdmin = accessRole === 'admin' || accessRole === 'team';
    veTodosCards = isAdmin || role === 'consultor' || role === 'supervisor';
  } else {
    isAdmin = true;
    veTodosCards = true;
  }

  if (!kanban) {
    return {
      kanban: null,
      fases: [],
      cards: [],
      cardsConcluidos: [],
      role,
      isAdmin,
      snapshotMode,
    };
  }

  const kanbanIdStr = String(kanban.id);
  const isFunilLoteadores = isKanbanFunilLoteadoresRef(kanbanIdStr, kanbanNomeDb);
  const sempreNativo = KANBANS_SEMPRE_NATIVOS.has(kanbanNomeDb);
  const hibridoComView = KANBANS_HIBRIDOS_COM_VIEW_LEGADO.has(kanbanNomeDb);

  const [fases, nativeCountResult] = await Promise.all([
    fetchKanbanFasesAtivas(supabase, kanbanIdStr),
    supabase
      .from('kanban_cards')
      .select('*', { count: 'exact', head: true })
      .eq('kanban_id', kanban.id),
  ]);

  /** Funis nativos: sempre tenta ler `kanban_cards` (count com RLS pode ser 0 mesmo com linhas). */
  const hasNativo = (nativeCountResult.count ?? 0) > 0 || sempreNativo;

  /**
   * Arquivados/concluídos: só nativos no filtro STATUS.
   * Nativos puros: skip view.
   * Híbridos Contabilidade/Cash Me: mantêm view no lean para lacunas (proteção).
   */
  const skipLegadoView =
    snapshotMode === 'arquivados' ||
    snapshotMode === 'concluidos' ||
    sempreNativo ||
    (hasNativo && !hibridoComView);

  let rowsAll: ViewLegadoRow[] = [];
  if (!skipLegadoView) {
    let viewQuery = supabase
      .from('v_processo_como_kanban_cards')
      .select(
        'id, kanban_id, fase_id, titulo, status, criado_em, responsavel_id, etapa_slug, origem, data_reuniao, data_followup',
      )
      .eq('kanban_id', kanban.id)
      .order('criado_em', { ascending: false });

    if (userId && !veTodosCards) {
      viewQuery = viewQuery.eq('responsavel_id', userId);
    }

    const viewResult = await viewQuery;
    rowsAll = (viewResult.data ?? []) as ViewLegadoRow[];
  }

  const processoIdsAll = rowsAll.map((r) => String(r.id)).filter(Boolean);
  const archivedLegadoIds = new Set<string>();
  if (processoIdsAll.length > 0) {
    const { data: archRows } = await supabase
      .from('kanban_cards')
      .select('id')
      .in('id', processoIdsAll)
      .eq('arquivado', true);
    for (const row of archRows ?? []) {
      const id = String((row as { id?: string }).id ?? '').trim();
      if (id) archivedLegadoIds.add(id);
    }
  }
  const rows = rowsAll.filter((r) => !archivedLegadoIds.has(String(r.id)));

  const franqueadoIdsLegado = [...new Set(rows.map((r) => r.responsavel_id).filter(Boolean))] as string[];
  const redeNomeMapLegado = new Map<string, string>();
  if (franqueadoIdsLegado.length > 0) {
    const { data: redes } = await supabase
      .from('rede_franqueados')
      .select('id, nome_completo')
      .in('id', franqueadoIdsLegado);
    (redes ?? []).forEach((r) => {
      if (r.nome_completo) redeNomeMapLegado.set(String(r.id), String(r.nome_completo));
    });
  }

  const processoIds = rows.map((r) => String(r.id)).filter(Boolean);
  const slaBasePorCardId = new Map<
    string,
    { entered_fase_at: string | null; sla_iniciado_em: string | null }
  >();
  if (processoIds.length > 0) {
    const { data: slaRows, error: slaErr } = await supabase
      .from('kanban_cards')
      .select('id, entered_fase_at, sla_iniciado_em')
      .in('id', processoIds);
    if (!slaErr) {
      for (const row of slaRows ?? []) {
        const id = String((row as { id?: string }).id ?? '').trim();
        if (!id) continue;
        slaBasePorCardId.set(id, {
          entered_fase_at:
            (row as { entered_fase_at?: string | null }).entered_fase_at != null
              ? String((row as { entered_fase_at?: string | null }).entered_fase_at)
              : null,
          sla_iniciado_em:
            (row as { sla_iniciado_em?: string | null }).sla_iniciado_em != null
              ? String((row as { sla_iniciado_em?: string | null }).sla_iniciado_em)
              : null,
        });
      }
    }
  }
  const franqueadoNomeMap = new Map<string, string>();
  const legadoOrdemMap = new Map<string, number>();
  const legadoTituloMap = new Map<string, string>();
  if (processoIds.length > 0) {
    const { data: processos } = await supabase
      .from('processo_step_one')
      .select('id, numero_franquia, nome_condominio, quadra, lote, ordem_coluna_painel')
      .in('id', processoIds);
    (processos ?? []).forEach((p) => {
      const pid = String(p.id);
      legadoOrdemMap.set(pid, Number((p as { ordem_coluna_painel?: number | null }).ordem_coluna_painel ?? 0));
    });
    const numeros = [...new Set((processos ?? []).map((p) => p.numero_franquia).filter(Boolean))] as string[];
    const redeByNumero = new Map<string, string>();
    if (numeros.length > 0) {
      const { data: redes } = await supabase
        .from('rede_franqueados')
        .select('n_franquia, nome_completo')
        .in('n_franquia', numeros);
      for (const r of redes ?? []) {
        const num = String(r.n_franquia ?? '').trim();
        const nome = String(r.nome_completo ?? '').trim();
        if (num && nome) redeByNumero.set(num, nome);
      }
    }
    (processos ?? []).forEach((p) => {
      const pid = String(p.id);
      const viewTitulo = rows.find((r) => String(r.id) === pid)?.titulo ?? '';
      const num = String((p as { numero_franquia?: string | null }).numero_franquia ?? '').trim();
      const tituloCalc = montarTituloCardSync({
        nFranquia: num || null,
        nomeFranqueado: num ? redeByNumero.get(num) : null,
        nomeCondominio: (p as { nome_condominio?: string | null }).nome_condominio,
        quadra: (p as { quadra?: string | null }).quadra,
        lote: (p as { lote?: string | null }).lote,
        tituloFallback: viewTitulo,
      });
      if (tituloCalc) legadoTituloMap.set(pid, tituloCalc);
      if (num && redeByNumero.has(num)) {
        franqueadoNomeMap.set(pid, redeByNumero.get(num)!);
      }
    });
  }

  const cardsLegado: KanbanCardBrief[] = rows.map((r) => {
    const fid = r.responsavel_id ? String(r.responsavel_id) : null;
    const cardId = String(r.id);
    const slaBase = slaBasePorCardId.get(cardId);
    return {
      id: cardId,
      titulo: legadoTituloMap.get(cardId) ?? String(r.titulo ?? ''),
      status: String(r.status ?? ''),
      created_at: String(r.criado_em ?? ''),
      fase_id: String(r.fase_id ?? ''),
      franqueado_id: fid ?? '',
      ordem_coluna: legadoOrdemMap.get(cardId) ?? 0,
      arquivado: false,
      motivo_arquivamento: null,
      concluido: false,
      concluido_em: null,
      origem: 'legado' as const,
      data_reuniao: dataIsoParaInput(r.data_reuniao),
      data_followup: dataIsoParaInput(r.data_followup),
      entered_fase_at: slaBase?.entered_fase_at ?? null,
      sla_iniciado_em: slaBase?.sla_iniciado_em ?? null,
      profiles: franqueadoNomeMap.has(String(r.id))
        ? { full_name: franqueadoNomeMap.get(String(r.id)) ?? null }
        : fid && redeNomeMapLegado.has(fid)
          ? { full_name: redeNomeMapLegado.get(fid) ?? null }
          : null,
    };
  });

  let cardsRaw: unknown[] = [];
  let conclRaw: unknown[] = [];
  let arquivRaw: unknown[] = [];
  if (hasNativo) {
    type KanbanCardRow = Record<string, unknown>;
    const emptyRes = {
      data: [] as KanbanCardRow[],
      error: null as { message: string } | null,
      slaColsAvailable: false,
    };
    const buildCardsQuery = async (select: string, concluido: boolean, arquivado: boolean) => {
      let q = supabase
        .from('kanban_cards')
        .select(select)
        .eq('kanban_id', kanban.id)
        .eq('status', 'ativo')
        .order('ordem_coluna', { ascending: true })
        .order('created_at', { ascending: false });
      if (concluido) {
        q = q.eq('concluido', true);
      } else {
        q = q.or('concluido.eq.false,concluido.is.null');
      }
      if (arquivado) {
        q = q.eq('arquivado', true);
      } else {
        q = q.or('arquivado.eq.false,arquivado.is.null');
      }
      if (userId && !veTodosCards) q = q.eq('franqueado_id', userId);
      const { data, error } = await q;
      return {
        data: (data ?? null) as KanbanCardRow[] | null,
        error: error ? { message: error.message } : null,
      };
    };

    const [cardsRes, conclRes, arquivRes] = await Promise.all([
      wantAtivos
        ? runKanbanCardSelectWithSlaFallback<KanbanCardRow[]>((select) =>
            buildCardsQuery(select, false, false),
          )
        : Promise.resolve(emptyRes),
      wantConcluidos
        ? runKanbanCardSelectWithSlaFallback<KanbanCardRow[]>((select) =>
            buildCardsQuery(select, true, false),
          )
        : Promise.resolve(emptyRes),
      wantArquivados
        ? runKanbanCardSelectWithSlaFallback<KanbanCardRow[]>((select) =>
            buildCardsQuery(select, false, true),
          )
        : Promise.resolve(emptyRes),
    ]);

    cardsRaw = (cardsRes.data ?? []) as unknown[];
    conclRaw = (conclRes.data ?? []) as unknown[];
    arquivRaw = (arquivRes.data ?? []) as unknown[];
  }

  const redeIdsDiretos = [
    ...new Set([
      ...(cardsRaw?.map((c) => (c as { rede_franqueado_id?: string | null }).rede_franqueado_id) ?? []).filter(Boolean),
      ...(conclRaw?.map((c) => (c as { rede_franqueado_id?: string | null }).rede_franqueado_id) ?? []).filter(Boolean),
      ...(arquivRaw?.map((c) => (c as { rede_franqueado_id?: string | null }).rede_franqueado_id) ?? []).filter(Boolean),
    ]),
  ] as string[];

  const redeById = new Map<string, string>();
  const nFranquiaByRedeId = new Map<string, string>();
  if (redeIdsDiretos.length > 0) {
    const { data: redesData } = await supabase
      .from('rede_franqueados')
      .select('id, nome_completo, n_franquia')
      .in('id', redeIdsDiretos);
    (redesData ?? []).forEach((r) => {
      if (r.nome_completo) redeById.set(String(r.id), String(r.nome_completo));
      const num = String((r as { n_franquia?: string | null }).n_franquia ?? '').trim();
      if (num) nFranquiaByRedeId.set(String(r.id), num);
    });
  }

  const redeNomeDiretoMap = new Map<string, string>();
  for (const id of redeIdsDiretos) {
    const nome = redeById.get(id);
    if (nome) redeNomeDiretoMap.set(id, nome);
  }

  /** Cards sem `rede_franqueado_id`: resolve nome/nº via processo/título (nunca perfil interno de `franqueado_id`). */
  const franqueadoNomePorCardId = new Map<string, string>();
  const nFranquiaPorCardId = new Map<string, string>();
  const allNativeCards = [
    ...((cardsRaw ?? []) as {
      id?: string;
      projeto_id?: string | null;
      rede_franqueado_id?: string | null;
      titulo?: string | null;
      nome_condominio?: string | null;
    }[]),
    ...((conclRaw ?? []) as {
      id?: string;
      projeto_id?: string | null;
      rede_franqueado_id?: string | null;
      titulo?: string | null;
      nome_condominio?: string | null;
    }[]),
    ...((arquivRaw ?? []) as {
      id?: string;
      projeto_id?: string | null;
      rede_franqueado_id?: string | null;
      titulo?: string | null;
      nome_condominio?: string | null;
    }[]),
  ];
  const cardsSemRede = allNativeCards.filter((c) => !String(c.rede_franqueado_id ?? '').trim());

  if (cardsSemRede.length > 0) {
    const processoIdsToFetch = new Set<string>();
    const numerosFranquia = new Set<string>();

    for (const c of cardsSemRede) {
      const id = String(c.id ?? '').trim();
      const pid = String(c.projeto_id ?? '').trim();
      if (id) processoIdsToFetch.add(id);
      if (pid) processoIdsToFetch.add(pid);
      const num = extrairNumeroFranquiaDoTitulo(String(c.titulo ?? ''));
      if (num) numerosFranquia.add(num);
    }

    const processoPorId = new Map<
      string,
      { numero_franquia?: string | null; origem_rede_franqueados_id?: string | null }
    >();
    if (processoIdsToFetch.size > 0) {
      const { data: processos } = await supabase
        .from('processo_step_one')
        .select('id, numero_franquia, origem_rede_franqueados_id')
        .in('id', [...processoIdsToFetch]);
      for (const p of processos ?? []) {
        processoPorId.set(String(p.id), p);
        const num = String(p.numero_franquia ?? '').trim();
        if (num) numerosFranquia.add(num);
      }
    }

    const redeNomePorNumero = new Map<string, string>();
    const redeNomePorRedeId = new Map<string, string>(redeById);
    const origemRedeIds = new Set<string>();
    for (const p of processoPorId.values()) {
      const rid = String(p.origem_rede_franqueados_id ?? '').trim();
      if (rid && !redeNomePorRedeId.has(rid)) origemRedeIds.add(rid);
    }

    if (numerosFranquia.size > 0 || origemRedeIds.size > 0) {
      const lookups = await Promise.all([
        numerosFranquia.size > 0
          ? supabase
              .from('rede_franqueados')
              .select('id, n_franquia, nome_completo')
              .in('n_franquia', [...numerosFranquia])
          : Promise.resolve({ data: [] as { id: string; n_franquia: string | null; nome_completo: string | null }[] }),
        origemRedeIds.size > 0
          ? supabase
              .from('rede_franqueados')
              .select('id, n_franquia, nome_completo')
              .in('id', [...origemRedeIds])
          : Promise.resolve({ data: [] as { id: string; n_franquia: string | null; nome_completo: string | null }[] }),
      ]);
      for (const r of [...(lookups[0].data ?? []), ...(lookups[1].data ?? [])]) {
        const nome = String(r.nome_completo ?? '').trim();
        const num = String(r.n_franquia ?? '').trim();
        if (num && nome) redeNomePorNumero.set(num, nome);
        if (r.id && nome) redeNomePorRedeId.set(String(r.id), nome);
      }
    }

    for (const c of cardsSemRede) {
      const cardId = String(c.id ?? '').trim();
      if (!cardId) continue;

      let nome: string | null = null;
      let nFranquia: string | null = null;
      const numTitulo = extrairNumeroFranquiaDoTitulo(String(c.titulo ?? ''));
      if (numTitulo && redeNomePorNumero.has(numTitulo)) {
        nome = redeNomePorNumero.get(numTitulo)!;
        nFranquia = numTitulo;
      }

      if (!nome) {
        const proc =
          processoPorId.get(String(c.projeto_id ?? '').trim()) ?? processoPorId.get(cardId);
        if (proc) {
          const origemId = String(proc.origem_rede_franqueados_id ?? '').trim();
          if (origemId && redeNomePorRedeId.has(origemId)) {
            nome = redeNomePorRedeId.get(origemId)!;
          } else {
            const numProc = String(proc.numero_franquia ?? '').trim();
            if (numProc && redeNomePorNumero.has(numProc)) {
              nome = redeNomePorNumero.get(numProc)!;
              nFranquia = numProc;
            }
          }
          if (!nFranquia) {
            const numProc = String(proc.numero_franquia ?? '').trim();
            if (numProc) nFranquia = numProc;
          }
        }
      }

      if (nome) franqueadoNomePorCardId.set(cardId, nome);
      if (nFranquia) nFranquiaPorCardId.set(cardId, nFranquia);
    }

    const condominiosSemNome = [
      ...new Set(
        cardsSemRede
          .filter((c) => !franqueadoNomePorCardId.has(String(c.id ?? '').trim()))
          .flatMap((c) => {
            const nomes = [
              String(c.nome_condominio ?? '').trim(),
              String(c.titulo ?? '').trim(),
            ].filter(Boolean);
            return nomes;
          }),
      ),
    ];

    if (condominiosSemNome.length > 0) {
      const { data: processosPorCondominio } = await supabase
        .from('processo_step_one')
        .select('nome_condominio, origem_rede_franqueados_id, numero_franquia')
        .in('nome_condominio', condominiosSemNome);
      const redeIdsCondominio = new Set<string>();
      const numerosCondominio = new Set<string>();
      const nomeParaRedeId = new Map<string, string>();
      const nomeParaNumero = new Map<string, string>();

      for (const p of processosPorCondominio ?? []) {
        const nomeCond = String(p.nome_condominio ?? '').trim();
        const origemId = String(p.origem_rede_franqueados_id ?? '').trim();
        const num = String(p.numero_franquia ?? '').trim();
        if (!nomeCond) continue;
        if (origemId) {
          nomeParaRedeId.set(nomeCond.toLowerCase(), origemId);
          redeIdsCondominio.add(origemId);
        } else if (num) {
          nomeParaNumero.set(nomeCond.toLowerCase(), num);
          numerosCondominio.add(num);
        }
      }

      if (redeIdsCondominio.size > 0 || numerosCondominio.size > 0) {
        const lookups = await Promise.all([
          redeIdsCondominio.size > 0
            ? supabase
                .from('rede_franqueados')
                .select('id, nome_completo')
                .in('id', [...redeIdsCondominio])
            : Promise.resolve({ data: [] as { id: string; nome_completo: string | null }[] }),
          numerosCondominio.size > 0
            ? supabase
                .from('rede_franqueados')
                .select('n_franquia, nome_completo')
                .in('n_franquia', [...numerosCondominio])
            : Promise.resolve({ data: [] as { n_franquia: string | null; nome_completo: string | null }[] }),
        ]);
        const nomePorRedeId = new Map<string, string>();
        for (const r of lookups[0].data ?? []) {
          const nome = String(r.nome_completo ?? '').trim();
          if (r.id && nome) nomePorRedeId.set(String(r.id), nome);
        }
        const nomePorNumero = new Map<string, string>();
        for (const r of lookups[1].data ?? []) {
          const nome = String(r.nome_completo ?? '').trim();
          const num = String(r.n_franquia ?? '').trim();
          if (num && nome) nomePorNumero.set(num, nome);
        }

        for (const c of cardsSemRede) {
          const cardId = String(c.id ?? '').trim();
          if (!cardId || franqueadoNomePorCardId.has(cardId)) continue;
          const chaves = [
            String(c.nome_condominio ?? '').trim().toLowerCase(),
            String(c.titulo ?? '').trim().toLowerCase(),
          ].filter(Boolean);
          for (const chave of chaves) {
            const redeId = nomeParaRedeId.get(chave);
            if (redeId && nomePorRedeId.has(redeId)) {
              franqueadoNomePorCardId.set(cardId, nomePorRedeId.get(redeId)!);
              break;
            }
            const num = nomeParaNumero.get(chave);
            if (num && nomePorNumero.has(num)) {
              franqueadoNomePorCardId.set(cardId, nomePorNumero.get(num)!);
              break;
            }
          }
        }
      }
    }
  }

  const processoIdsCampos = new Set<string>();
  for (const c of allNativeCards) {
    const id = String(c.id ?? '').trim();
    const pid = String(c.projeto_id ?? '').trim();
    if (id) processoIdsCampos.add(id);
    if (pid) processoIdsCampos.add(pid);
  }
  const processoCamposMap = await fetchProcessoCamposPorIds(supabase, [...processoIdsCampos]);

  const cardsNativosRaw = [
    ...((cardsRaw ?? []) as Record<string, unknown>[]),
    ...((conclRaw ?? []) as Record<string, unknown>[]),
    ...((arquivRaw ?? []) as Record<string, unknown>[]),
  ];
  const [ancestraisMap, irmaosProjetoMap] = await Promise.all([
    fetchCamposAncestraisPorCard(supabase, cardsNativosRaw),
    fetchCamposIrmaosPorProjeto(supabase, cardsNativosRaw),
  ]);

  const loteadorPorId = new Map<
    string,
    {
      nome: string;
      contato_nome: string | null;
      interlocutor_nome: string | null;
      condominio_nome: string | null;
    }
  >();
  if (isFunilLoteadores) {
    const redeLoteadorIds = [
      ...new Set(
        cardsNativosRaw
          .map((c) => String((c as { rede_loteador_id?: string | null }).rede_loteador_id ?? '').trim())
          .filter(Boolean),
      ),
    ];
    if (redeLoteadorIds.length > 0) {
      const { data: loteadoresRows } = await supabase
        .from('rede_loteadores')
        .select('id, nome, contato_nome, interlocutor_nome, condominio_nome')
        .in('id', redeLoteadorIds);
      for (const row of loteadoresRows ?? []) {
        const id = String((row as { id?: string }).id ?? '').trim();
        if (!id) continue;
        loteadorPorId.set(id, {
          nome: String((row as { nome?: string | null }).nome ?? '').trim(),
          contato_nome: (row as { contato_nome?: string | null }).contato_nome ?? null,
          interlocutor_nome: (row as { interlocutor_nome?: string | null }).interlocutor_nome ?? null,
          condominio_nome: (row as { condominio_nome?: string | null }).condominio_nome ?? null,
        });
      }
    }
  }

  const condominioNomePorId = new Map<string, string>();
  if (isFunilLoteadores) {
    const condominioIds = [
      ...new Set(
        cardsNativosRaw
          .map((c) => String((c as { condominio_id?: string | null }).condominio_id ?? '').trim())
          .filter(Boolean),
      ),
    ];
    if (condominioIds.length > 0) {
      const { data: condominioRows } = await supabase.from('condominios').select('id, nome').in('id', condominioIds);
      for (const row of condominioRows ?? []) {
        const id = String((row as { id?: string }).id ?? '').trim();
        const nome = String((row as { nome?: string | null }).nome ?? '').trim();
        if (id && nome) condominioNomePorId.set(id, nome);
      }
    }
  }

  const mapNativo = (c: Record<string, unknown>): KanbanCardBrief => {
    const cMerged = mesclarCamposComProjetoIrmaos(
      mesclarCamposComAncestrais(c, ancestraisMap),
      irmaosProjetoMap,
    );
    const fid = String(cMerged.franqueado_id ?? '');
    const redeId = String((cMerged as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? '').trim();
    const cardId = String(cMerged.id ?? '');
    const tituloRaw = String(cMerged.titulo ?? '');
    const proc =
      processoCamposMap.get(cardId) ??
      (cMerged.projeto_id ? processoCamposMap.get(String(cMerged.projeto_id)) : undefined);
    const parsedTitulo = parseCamposDoTituloCard(tituloRaw);
    const quadraLoteProc = String(proc?.quadra_lote ?? '').trim();
    const nomeCondominio = coalesceTextoCampo(
      (cMerged as { nome_condominio?: string | null }).nome_condominio,
      proc?.nome_condominio,
      parsedTitulo.nomeCondominio,
      condominioNomePorId.get(
        String((cMerged as { condominio_id?: string | null }).condominio_id ?? '').trim(),
      ),
    );
    const quadra = coalesceTextoCampo(
      (cMerged as { quadra?: string | null }).quadra,
      proc?.quadra,
      parsedTitulo.quadra,
      quadraLoteProc ? quadraLoteProc.split('/')[0] : null,
    );
    const lote = coalesceTextoCampo(
      (cMerged as { lote?: string | null }).lote,
      proc?.lote,
      parsedTitulo.lote,
      quadraLoteProc ? quadraLoteProc.split('/')[1] : null,
    );
    const nFranquiaCard = redeId
      ? nFranquiaByRedeId.get(redeId)
      : nFranquiaPorCardId.get(cardId) ?? extrairNumeroFranquiaDoTitulo(tituloRaw);
    const tituloCalc = montarTituloCardSync({
      nFranquia: nFranquiaCard,
      nomeFranqueado: redeId
        ? redeNomeDiretoMap.get(redeId)
        : franqueadoNomePorCardId.get(cardId),
      nomeCondominio,
      quadra,
      lote,
      tituloFallback: tituloRaw,
    });

    let tituloExibicao = escolherTituloExibicaoCard(tituloRaw, tituloCalc, nFranquiaCard);
    let subtituloCard: string | null = null;
    let profilesLinha: KanbanCardBrief['profiles'] = redeNomeDiretoMap.has(redeId)
      ? { full_name: redeNomeDiretoMap.get(redeId) ?? null }
      : franqueadoNomePorCardId.has(cardId)
        ? { full_name: franqueadoNomePorCardId.get(cardId) ?? null }
        : null;

    if (isFunilLoteadores) {
      const redeLoteadorId = String(
        (cMerged as { rede_loteador_id?: string | null }).rede_loteador_id ?? '',
      ).trim();
      const rl = redeLoteadorId ? loteadorPorId.get(redeLoteadorId) : undefined;
      const nomeLoteador = coalesceTextoCampo(rl?.nome);
      if (nomeLoteador) {
        // Card com cadastro vinculado: título/subtítulo derivam do cadastro do loteador.
        const nomeCondominioLoteador = coalesceTextoCampo(rl?.condominio_nome, nomeCondominio);
        const tituloLoteador = montarTituloCardLoteadores({
          nomeLoteador,
          contatoNome: rl?.contato_nome,
          nomeCondominio: nomeCondominioLoteador,
          tituloFallback: tituloRaw,
        });
        tituloExibicao = tituloLoteador ?? tituloExibicao;
        subtituloCard = subtituloCardLoteadores(rl?.interlocutor_nome);
      } else {
        // Sem cadastro vinculado: mantém o título/subtítulo atuais do card.
        tituloExibicao = tituloRaw;
        subtituloCard = null;
      }
      profilesLinha = null;
    }

    return {
      id: String(cMerged.id),
      titulo: tituloExibicao,
      subtitulo: subtituloCard,
      status: String(cMerged.status ?? ''),
      created_at: String(cMerged.created_at ?? ''),
      fase_id: String(cMerged.fase_id ?? ''),
      ordem_coluna: Number((cMerged as { ordem_coluna?: number | null }).ordem_coluna ?? 0),
      kanban_id: kanbanIdStr,
      projeto_id: (cMerged as { projeto_id?: string | null }).projeto_id ?? null,
      franqueado_id: fid,
      arquivado: Boolean((cMerged as { arquivado?: boolean | null }).arquivado),
      motivo_arquivamento: (cMerged as { motivo_arquivamento?: string | null }).motivo_arquivamento ?? null,
      resultado: ((cMerged as { resultado?: string | null }).resultado ?? null) as 'perda' | 'ganho' | null,
      concluido: Boolean((cMerged as { concluido?: boolean | null }).concluido),
      concluido_em:
        (cMerged as { concluido_em?: string | null }).concluido_em != null
          ? String((cMerged as { concluido_em?: string | null }).concluido_em)
          : null,
      origem: 'nativo',
      data_reuniao: dataIsoParaInput(cMerged.data_reuniao),
      data_followup: dataIsoParaInput(cMerged.data_followup),
      acoplamento_concluido: Boolean((cMerged as { acoplamento_concluido?: boolean | null }).acoplamento_concluido),
      acoplamento_filho_fase_nome:
        (cMerged as { acoplamento_filho_fase_nome?: string | null }).acoplamento_filho_fase_nome ?? null,
      acoplamento_filho_fase_slug:
        (cMerged as { acoplamento_filho_fase_slug?: string | null }).acoplamento_filho_fase_slug ?? null,
      credito_terreno_ok: Boolean((cMerged as { credito_terreno_ok?: boolean | null }).credito_terreno_ok),
      contabilidade_ok: Boolean((cMerged as { contabilidade_ok?: boolean | null }).contabilidade_ok),
      capital_ok: Boolean((cMerged as { capital_ok?: boolean | null }).capital_ok),
      juridico_ok: Boolean((cMerged as { juridico_ok?: boolean | null }).juridico_ok),
      credito_obra_ok: Boolean((cMerged as { credito_obra_ok?: boolean | null }).credito_obra_ok),
      projetos_legais_ok:
        (cMerged as { projetos_legais_ok?: boolean | null }).projetos_legais_ok ?? null,
      projetos_locais_ok:
        (cMerged as { projetos_locais_ok?: boolean | null }).projetos_locais_ok ?? null,
      alvara_url: (cMerged as { alvara_url?: string | null }).alvara_url ?? null,
      docs_terreno_url: (cMerged as { docs_terreno_url?: string | null }).docs_terreno_url ?? null,
      sla_iniciado_em:
        (cMerged as { sla_iniciado_em?: string | null }).sla_iniciado_em != null
          ? String((cMerged as { sla_iniciado_em?: string | null }).sla_iniciado_em)
          : null,
      entered_fase_at:
        (cMerged as { entered_fase_at?: string | null }).entered_fase_at != null
          ? String((cMerged as { entered_fase_at?: string | null }).entered_fase_at)
          : null,
      profiles: profilesLinha,
      funding_tipo: (() => {
        const t = String((cMerged as { funding_tipo?: string | null }).funding_tipo ?? '').trim();
        return t === 'Investidor' || t === 'Broker' ? t : null;
      })(),
      funding_localizacao:
        (cMerged as { funding_localizacao?: string | null }).funding_localizacao ?? null,
      funding_descritivo:
        (cMerged as { funding_descritivo?: string | null }).funding_descritivo ?? null,
      proxima_atividade:
        (cMerged as { proxima_atividade?: string | null }).proxima_atividade ?? null,
      prazo_atividade: dataIsoParaInput(
        (cMerged as { prazo_atividade?: string | null }).prazo_atividade,
      ),
    };
  };

  let cardsNativo = (cardsRaw ?? []).map((c) => mapNativo(c as unknown as Record<string, unknown>));
  let cardsConcluidos = (conclRaw ?? []).map((c) => mapNativo(c as unknown as Record<string, unknown>));
  let cardsArquivadosNativo = (arquivRaw ?? []).map((c) => mapNativo(c as unknown as Record<string, unknown>));

  [cardsNativo, cardsConcluidos, cardsArquivadosNativo] = await Promise.all([
    enrichCardsParalelasContext(supabase, kanbanIdStr, cardsNativo),
    enrichCardsParalelasContext(supabase, kanbanIdStr, cardsConcluidos),
    enrichCardsParalelasContext(supabase, kanbanIdStr, cardsArquivadosNativo),
  ]);

  /** `processo_step_one.etapa_painel` prevalece sobre `kanban_cards.fase_id` (incl. UUID de outro funil). */
  const processoIdsReconciliar = coletarIdsProcessoDosCards(
    cardsNativo,
    cardsConcluidos,
    cardsArquivadosNativo,
    cardsLegado,
  );
  const etapaPorProcesso = await fetchEtapaPainelPorProcessoIds(supabase, processoIdsReconciliar);
  const slugsEtapa = [...etapaPorProcesso.values()].map((p) => p.etapa_painel);
  const slugParaFaseId = await buildSlugParaFaseIdMap(supabase, kanbanIdStr, fases, slugsEtapa);

  cardsNativo = aplicarFasePorEtapaPainelEmLote(cardsNativo, etapaPorProcesso, slugParaFaseId);
  cardsConcluidos = aplicarFasePorEtapaPainelEmLote(cardsConcluidos, etapaPorProcesso, slugParaFaseId);
  cardsArquivadosNativo = aplicarFasePorEtapaPainelEmLote(
    cardsArquivadosNativo,
    etapaPorProcesso,
    slugParaFaseId,
  );
  const cardsLegadoReconciliados = aplicarFasePorEtapaPainelEmLote(
    cardsLegado,
    etapaPorProcesso,
    slugParaFaseId,
  );

  const legadoPorId = new Map(cardsLegadoReconciliados.map((c) => [c.id, c]));
  const mesclarDatasLegado = (lista: KanbanCardBrief[]) =>
    lista.map((c) => coalesceDatasCardBrief(c, legadoPorId.get(c.id)));

  cardsNativo = mesclarDatasLegado(cardsNativo);
  cardsConcluidos = mesclarDatasLegado(cardsConcluidos);
  cardsArquivadosNativo = mesclarDatasLegado(cardsArquivadosNativo);

  cardsNativo = await enrichCardsDatasFromProcesso(supabase, cardsNativo);
  cardsConcluidos = await enrichCardsDatasFromProcesso(supabase, cardsConcluidos);
  cardsArquivadosNativo = await enrichCardsDatasFromProcesso(supabase, cardsArquivadosNativo);

  cardsNativo = await enrichCardsFollowupFromAtividades(supabase, cardsNativo);
  cardsConcluidos = await enrichCardsFollowupFromAtividades(supabase, cardsConcluidos);
  cardsArquivadosNativo = await enrichCardsFollowupFromAtividades(supabase, cardsArquivadosNativo);

  const idsComLinhaNativa = new Set([
    ...cardsNativo.map((c) => c.id),
    ...cardsConcluidos.map((c) => c.id),
    ...cardsArquivadosNativo.map((c) => c.id),
  ]);

  // Nativo prevalece quando existe linha; legado só preenche lacunas (sem duplicata por id).
  let cards = [
    ...cardsNativo,
    ...cardsArquivadosNativo,
    ...cardsLegadoReconciliados.filter((c) => !idsComLinhaNativa.has(c.id)),
  ].filter((c) => {
    const id = String(c.id ?? '').trim();
    return Boolean(id);
  });

  const allCardIds = [...new Set([...cards.map((c) => c.id), ...cardsConcluidos.map((c) => c.id)].filter(Boolean))];
  const faseIdsOrfas = [...cards.map((c) => c.fase_id), ...cardsConcluidos.map((c) => c.fase_id)];

  let [fasesComOrfas, tagsRes] = await Promise.all([
    augmentKanbanFasesComFasesDosCards(supabase, kanbanIdStr, fases, faseIdsOrfas),
    allCardIds.length > 0
      ? supabase
          .from('kanban_card_tags')
          .select('id, card_id, tag_id, kanban_tags(nome, cor)')
          .in('card_id', allCardIds)
      : Promise.resolve({ data: [] as { card_id: string; tag_id: string; kanban_tags: { nome: string | null; cor: string | null } | null }[] }),
  ]);

  if (kanbanIdStr === KANBAN_IDS.STEP_ONE) {
    const prepared = prepareStepOneBoardSnapshot({
      fases: fasesComOrfas,
      cards,
      cardsConcluidos,
    });
    fasesComOrfas = prepared.fases;
    cards = prepared.cards;
    cardsConcluidos = prepared.cardsConcluidos;
  }

  // Tags (nativo): agrega em lote e acopla ao card brief
  if (allCardIds.length > 0) {
    const rows = tagsRes.data;
    const byCardId = new Map<string, { id: string; tag_id: string; nome: string; cor: string }[]>();
    (rows ?? []).forEach((r) => {
      const cid = String((r as { card_id?: string | null }).card_id ?? '').trim();
      if (!cid) return;
      const id = String((r as { id?: string | null }).id ?? '').trim();
      const tag_id = String((r as { tag_id?: string | null }).tag_id ?? '').trim();
      const nome = String(((r as { kanban_tags?: { nome?: string | null } | null }).kanban_tags as { nome?: string | null } | null)?.nome ?? '');
      const cor = String(((r as { kanban_tags?: { cor?: string | null } | null }).kanban_tags as { cor?: string | null } | null)?.cor ?? '#cccccc');
      if (!id || !tag_id) return;
      const arr = byCardId.get(cid) ?? [];
      arr.push({ id, tag_id, nome, cor });
      byCardId.set(cid, arr);
    });
    const cardsTagged = cards.map((c) => ({ ...c, tagsCard: byCardId.get(c.id) ?? [] }));
    const cardsConcluidosTagged = cardsConcluidos.map((c) => ({ ...c, tagsCard: byCardId.get(c.id) ?? [] }));

    const [cardsComResp, cardsConcluidosComResp] = await Promise.all([
      enrichCardsComResponsavelFase(supabase, cardsTagged),
      enrichCardsComResponsavelFase(supabase, cardsConcluidosTagged),
    ]);

    return {
      kanban: { id: kanbanIdStr },
      fases: fasesComOrfas,
      cards: cardsComResp,
      cardsConcluidos: cardsConcluidosComResp,
      role,
      isAdmin,
      snapshotMode,
    };
  }

  const [cardsComResp, cardsConcluidosComResp] = await Promise.all([
    enrichCardsComResponsavelFase(supabase, cards),
    enrichCardsComResponsavelFase(supabase, cardsConcluidos),
  ]);

  return {
    kanban: { id: kanbanIdStr },
    fases: fasesComOrfas,
    cards: cardsComResp,
    cardsConcluidos: cardsConcluidosComResp,
    role,
    isAdmin,
    snapshotMode,
  };
}
