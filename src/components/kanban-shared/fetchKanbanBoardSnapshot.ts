import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAccessRole } from '@/lib/authz';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import { KANBAN_NOME_FUNIL_LOTEADORES } from '@/lib/kanban/funil-loteadores';
import { prepareStepOneBoardSnapshot } from '@/lib/kanban/stepone-fase-slugs';
import {
  augmentKanbanFasesComFasesDosCards,
  fetchKanbanFasesAtivasCached,
} from '@/lib/kanban/fetch-kanban-fases';
import { enrichCardsParalelasContext } from '@/lib/kanban/kanban-paralelas-chips';
import { enrichCardsComResponsavelFase } from '@/lib/kanban/responsavel-fase-checklist';
import { enrichCardsComCalculadoraSlaEstourado } from '@/lib/kanban/fetch-kanban-board-calculadora-sla';
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
  nomeResponsavelHeaderLoteador,
  subtituloCardLoteadores,
  tituloExibicaoCardLoteadores,
} from '@/lib/kanban/loteadores-card-titulo';
import {
  isKanbanFilhoDadosLaterais,
  resolverRedeLoteadorIdsPorCards,
} from '@/lib/kanban/card-dados-laterais-pai';
import {
  runKanbanCardSelectWithSlaFallback,
  runKanbanCardSelectBoardFast,
} from '@/lib/kanban/kanban-card-select-cols';
import { createKanbanSnapshotTimer } from '@/lib/kanban/kanban-snapshot-timing';
import { resolveKanbanAtivoCached } from '@/lib/kanban/resolve-kanban-ativo-cached';
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
  /** Evita enrich pesado da Calculadora ao abrir modal (`?card=`). */
  skipCalculadoraSlaEnrich?: boolean;
  /**
   * Paint inicial: cards + fases + tags; paralelas/responsável/calculadora via client após mount.
   * Reduz TTI do board (Portfolio e demais funis nativos).
   */
  deferBoardEnrichments?: boolean;
  /** Força skip da view legado (enrichment client-side após paint). */
  forceSkipLegadoView?: boolean;
};

/** Campos preenchidos só pelos enrichments adiados — merge no client. */
const DEFERRED_ENRICHMENT_KEYS = [
  'portfolio_vinculo_rotulo',
  'tem_filho_juridico',
  'tem_filho_acoplamento',
  'filho_acoplamento_arquivado',
  'tem_filho_operacoes',
  'filho_operacoes_arquivado',
  'operacoes_filho_fase_rotulo',
  'operacoes_filho_concluido',
  'juridico_filho_fase_nome',
  'tem_filho_projeto_legal',
  'filho_projeto_legal_arquivado',
  'projeto_legal_filho_concluido',
  'projeto_legal_filho_fase',
  'tem_filho_credito_obra',
  'filho_credito_obra_arquivado',
  'credito_obra_filho_fase',
  'tem_filho_projetos_locais',
  'filho_projetos_locais_arquivado',
  'projetos_locais_filho_fase',
  'projetos_locais_filho_concluido',
  'tem_filho_divify',
  'filho_divify_arquivado',
  'divify_filho_concluido',
  'divify_filho_fase',
  'acoplamento_filho_fase_nome',
  'acoplamento_filho_fase_slug',
  'responsavel_fase_id',
  'responsavel_fase_nome',
  'calculadora_sla_estourado',
  'calculadora_atraso_dias',
  'calculadora_atraso_tipo',
] as const satisfies readonly (keyof KanbanCardBrief)[];

function mapNativoFastRow(c: Record<string, unknown>, kanbanIdStr: string): KanbanCardBrief {
  return {
    id: String(c.id ?? ''),
    titulo: String(c.titulo ?? ''),
    status: String(c.status ?? ''),
    created_at: String(c.created_at ?? ''),
    fase_id: String(c.fase_id ?? ''),
    franqueado_id: String(c.franqueado_id ?? ''),
    ordem_coluna: Number((c as { ordem_coluna?: number | null }).ordem_coluna ?? 0),
    kanban_id: kanbanIdStr,
    projeto_id: (c as { projeto_id?: string | null }).projeto_id ?? null,
    arquivado: Boolean((c as { arquivado?: boolean | null }).arquivado),
    concluido: Boolean((c as { concluido?: boolean | null }).concluido),
    concluido_em:
      (c as { concluido_em?: string | null }).concluido_em != null
        ? String((c as { concluido_em?: string | null }).concluido_em)
        : null,
    origem: 'nativo',
    data_reuniao: dataIsoParaInput(c.data_reuniao),
    data_followup: dataIsoParaInput(c.data_followup),
    proxima_atividade:
      (c as { proxima_atividade?: string | null }).proxima_atividade ?? null,
    prazo_atividade: dataIsoParaInput(
      (c as { prazo_atividade?: string | null }).prazo_atividade,
    ),
    entered_fase_at:
      (c as { entered_fase_at?: string | null }).entered_fase_at != null
        ? String((c as { entered_fase_at?: string | null }).entered_fase_at)
        : null,
    sla_iniciado_em:
      (c as { sla_iniciado_em?: string | null }).sla_iniciado_em != null
        ? String((c as { sla_iniciado_em?: string | null }).sla_iniciado_em)
        : null,
    profiles: null,
  };
}

function pickDeferredEnrichmentFields(card: KanbanCardBrief): Partial<KanbanCardBrief> {
  const out: Partial<KanbanCardBrief> = {};
  for (const key of DEFERRED_ENRICHMENT_KEYS) {
    const v = card[key];
    if (v !== undefined && v !== null && v !== false && v !== '') {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}

type KanbanCardTagBrief = { id: string; tag_id: string; nome: string; cor: string };

async function fetchKanbanTagsByCardIds(
  supabase: SupabaseClient,
  cardIds: string[],
): Promise<Map<string, KanbanCardTagBrief[]>> {
  const byCardId = new Map<string, KanbanCardTagBrief[]>();
  const uniq = [...new Set(cardIds.map((id) => id.trim()).filter(Boolean))];
  if (uniq.length === 0) return byCardId;

  const { data: rows } = await supabase
    .from('kanban_card_tags')
    .select('id, card_id, tag_id, kanban_tags(nome, cor)')
    .in('card_id', uniq);

  for (const r of rows ?? []) {
    const cid = String((r as { card_id?: string | null }).card_id ?? '').trim();
    if (!cid) continue;
    const id = String((r as { id?: string | null }).id ?? '').trim();
    const tag_id = String((r as { tag_id?: string | null }).tag_id ?? '').trim();
    const nome = String(
      ((r as { kanban_tags?: { nome?: string | null } | null }).kanban_tags as {
        nome?: string | null;
      } | null)?.nome ?? '',
    );
    const cor = String(
      ((r as { kanban_tags?: { cor?: string | null } | null }).kanban_tags as {
        cor?: string | null;
      } | null)?.cor ?? '#cccccc',
    );
    if (!id || !tag_id) continue;
    const arr = byCardId.get(cid) ?? [];
    arr.push({ id, tag_id, nome, cor });
    byCardId.set(cid, arr);
  }
  return byCardId;
}

function aplicarTagsKanbanCards(
  cards: KanbanCardBrief[],
  byCardId: Map<string, KanbanCardTagBrief[]>,
): KanbanCardBrief[] {
  return cards.map((c) => ({ ...c, tagsCard: byCardId.get(c.id) ?? [] }));
}

/** Título formatado + header do franqueado no paint rápido (sem ancestrais/paralelas). */
type LoteadorHeaderRow = {
  n_loteador: string | null;
  codigo: string | null;
  nome: string;
  contato_nome: string | null;
  interlocutor_nome: string | null;
  condominio_nome: string | null;
};

function precisaHeaderLoteadorNoBoard(kanbanIdStr: string, kanbanNomeDb: string): boolean {
  return (
    isKanbanFunilLoteadoresRef(kanbanIdStr, kanbanNomeDb) ||
    isKanbanFilhoDadosLaterais(kanbanIdStr, kanbanNomeDb)
  );
}

async function carregarLoteadorHeaderPorIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, LoteadorHeaderRow>> {
  const loteadorPorId = new Map<string, LoteadorHeaderRow>();
  const uniq = [...new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))];
  if (uniq.length === 0) return loteadorPorId;
  const { data: loteadoresRows } = await supabase
    .from('rede_loteadores')
    .select('id, n_loteador, codigo, nome, contato_nome, interlocutor_nome, condominio_nome')
    .in('id', uniq);
  for (const row of loteadoresRows ?? []) {
    const id = String((row as { id?: string }).id ?? '').trim();
    if (!id) continue;
    loteadorPorId.set(id, {
      n_loteador: (row as { n_loteador?: string | null }).n_loteador ?? null,
      codigo: (row as { codigo?: string | null }).codigo ?? null,
      nome: String((row as { nome?: string | null }).nome ?? '').trim(),
      contato_nome: (row as { contato_nome?: string | null }).contato_nome ?? null,
      interlocutor_nome: (row as { interlocutor_nome?: string | null }).interlocutor_nome ?? null,
      condominio_nome: (row as { condominio_nome?: string | null }).condominio_nome ?? null,
    });
  }
  return loteadorPorId;
}

async function enrichFastPaintCardsParaExibicao(
  supabase: SupabaseClient,
  kanbanIdStr: string,
  kanbanNomeDb: string,
  cardsRaw: Record<string, unknown>[],
  cards: KanbanCardBrief[],
): Promise<KanbanCardBrief[]> {
  if (cards.length === 0) return cards;

  const isFunilLoteadores = isKanbanFunilLoteadoresRef(kanbanIdStr, kanbanNomeDb);
  const headerLoteador = precisaHeaderLoteadorNoBoard(kanbanIdStr, kanbanNomeDb);
  const franqueadoMaps = await resolveNativeFranqueadoMaps(supabase, cardsRaw, [], []);
  const {
    redeNomeDiretoMap,
    franqueadoNomePorCardId,
    nFranquiaPorCardId,
    nFranquiaByRedeId,
  } = franqueadoMaps;

  const loteadorIdPorCard = headerLoteador
    ? await resolverRedeLoteadorIdsPorCards(supabase, cardsRaw)
    : new Map<string, string>();
  const loteadorPorId = headerLoteador
    ? await carregarLoteadorHeaderPorIds(supabase, [...loteadorIdPorCard.values()])
    : new Map<string, LoteadorHeaderRow>();

  const rawById = new Map(cardsRaw.map((r) => [String(r.id ?? ''), r]));

  return cards.map((card) => {
    const c = rawById.get(card.id);
    if (!c) return card;

    const redeId = String(c.rede_franqueado_id ?? '').trim();
    const cardId = card.id;
    const tituloRaw = String(c.titulo ?? card.titulo ?? '');
    const parsedTitulo = parseCamposDoTituloCard(tituloRaw);
    const nomeCondominio = coalesceTextoCampo(c.nome_condominio, parsedTitulo.nomeCondominio);
    const quadra = coalesceTextoCampo(c.quadra, parsedTitulo.quadra);
    const lote = coalesceTextoCampo(c.lote, parsedTitulo.lote);
    const nFranquiaCard = redeId
      ? nFranquiaByRedeId.get(redeId)
      : nFranquiaPorCardId.get(cardId) ?? extrairNumeroFranquiaDoTitulo(tituloRaw);
    const nomeFranqueadoCard = redeId
      ? redeNomeDiretoMap.get(redeId)
      : franqueadoNomePorCardId.get(cardId);
    const tituloCalc = montarTituloCardSync({
      nFranquia: nFranquiaCard,
      nomeFranqueado: nomeFranqueadoCard,
      nomeCondominio,
      quadra,
      lote,
      tituloFallback: tituloRaw,
    });
    let tituloExibicao = escolherTituloExibicaoCard(
      tituloRaw,
      tituloCalc,
      nFranquiaCard,
      nomeFranqueadoCard,
      { nomeCondominio, quadra, lote },
    );
    let subtituloCard: string | null = null;
    let profilesLinha: KanbanCardBrief['profiles'] =
      redeId && redeNomeDiretoMap.has(redeId)
        ? { full_name: redeNomeDiretoMap.get(redeId) ?? null }
        : franqueadoNomePorCardId.has(cardId)
          ? { full_name: franqueadoNomePorCardId.get(cardId) ?? null }
          : null;

    const redeLoteadorId = loteadorIdPorCard.get(cardId) ?? String(c.rede_loteador_id ?? '').trim();
    const rl = redeLoteadorId ? loteadorPorId.get(redeLoteadorId) : undefined;
    if (isFunilLoteadores || rl) {
      const nomeHeader = nomeResponsavelHeaderLoteador(rl);
      tituloExibicao =
        tituloExibicaoCardLoteadores(
          { titulo: tituloRaw, nome_condominio: c.nome_condominio as string | null | undefined },
          rl,
        ) ?? tituloExibicao;
      subtituloCard = subtituloCardLoteadores(rl?.nome, nomeHeader, {
        titulo: tituloExibicao,
        nomeCondominio: c.nome_condominio as string | null | undefined,
      });
      profilesLinha = nomeHeader ? { full_name: nomeHeader } : null;
    }

    return {
      ...card,
      titulo: tituloExibicao,
      subtitulo: subtituloCard,
      profiles: profilesLinha,
    };
  });
}

/** Processos já cobertos por linha nativa (evita duplicata legado+nativo no board híbrido). */
async function buildProcessoIdsCobertosPorNativo(
  supabase: SupabaseClient,
  cardsNativo: KanbanCardBrief[],
): Promise<Set<string>> {
  const out = new Set<string>();
  for (const c of cardsNativo) {
    const id = String(c.id ?? '').trim();
    if (id) out.add(id);
    const proj = String(c.projeto_id ?? '').trim();
    if (proj) out.add(proj);
  }

  const ids = cardsNativo.map((c) => c.id).filter(Boolean);
  if (ids.length === 0) return out;

  const { data } = await supabase
    .from('kanban_cards')
    .select('id, processo_step_one_id')
    .in('id', ids);

  for (const row of data ?? []) {
    const id = String((row as { id?: string }).id ?? '').trim();
    if (id) out.add(id);
    const proc = String(
      (row as { processo_step_one_id?: string | null }).processo_step_one_id ?? '',
    ).trim();
    if (proc) out.add(proc);
  }

  return out;
}

/** Remove duplicatas por `id` após merge nativo+legado; nativo prevalece sobre legado. */
function dedupeKanbanCardsPreferindoNativo(cards: KanbanCardBrief[]): KanbanCardBrief[] {
  const byId = new Map<string, KanbanCardBrief>();
  for (const c of cards) {
    const id = String(c.id ?? '').trim();
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, c);
      continue;
    }
    if (existing.origem === 'legado' && c.origem !== 'legado') {
      byId.set(id, c);
    }
  }
  return [...byId.values()];
}

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

export type KanbanBoardShell = {
  kanban: { id: string } | null;
  fases: KanbanFase[];
  role: string;
  isAdmin: boolean;
};

/** Metadados leves do board (kanban + fases + auth) — fica fora do Suspense dos cards. */
export async function fetchKanbanBoardShell(
  supabase: SupabaseClient,
  kanbanNomeDb: string,
  userId: string | null,
): Promise<KanbanBoardShell> {
  let role = 'frank';
  let isAdmin = false;

  const profilePromise = userId
    ? supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
    : Promise.resolve({ data: null as { role?: string | null } | null });

  const [profileRes, kanban] = await Promise.all([
    profilePromise,
    resolveKanbanAtivoCached(supabase, kanbanNomeDb),
  ]);

  if (userId) {
    const profile = profileRes.data;
    role = (profile?.role as string) ?? 'frank';
    const accessRole = normalizeAccessRole(profile?.role);
    isAdmin = accessRole === 'admin' || accessRole === 'team';
  } else {
    isAdmin = true;
  }

  if (!kanban) {
    return { kanban: null, fases: [], role, isAdmin };
  }

  const kanbanIdStr = String(kanban.id);
  const fases = await fetchKanbanFasesAtivasCached(supabase, kanbanIdStr);
  return { kanban: { id: kanbanIdStr }, fases, role, isAdmin };
}

/** Opções estáveis para paint inicial — enrichments pesados ficam no client. */
export const KANBAN_BOARD_DEFERRED_FETCH_OPTS: FetchKanbanBoardSnapshotOptions = {
  deferBoardEnrichments: true,
  skipCalculadoraSlaEnrich: true,
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
  'Funil Crédito Obra',
  'Funil Cash Me',
  'Funil Crédito',
]);

/** Funis com paint inicial mínimo — enrichments completos via client após mount. */
const KANBANS_FAST_PAINT = new Set(['Funil Portfólio', 'Funil Operações', 'Funil Loteadores']);

function isFastPaintKanban(kanbanNomeDb: string): boolean {
  return KANBANS_FAST_PAINT.has(kanbanNomeDb);
}

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

/** Card filho de bastão (`origem_card_id`) — exibe dados próprios, sem merge de identidade do pai. */
function isFilhoBastaoCard(c: Record<string, unknown>): boolean {
  return Boolean(String((c as { origem_card_id?: string | null }).origem_card_id ?? '').trim());
}

/** Evita walk recursivo em `origem_card_id` quando o card já tem campos de exibição completos. */
function cardNativoPrecisaCamposAncestrais(c: Record<string, unknown>): boolean {
  const origem = String((c as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
  if (!origem) return false;
  const titulo = String(c.titulo ?? '').trim();
  const parsed = parseCamposDoTituloCard(titulo);
  const temCondominio = Boolean(coalesceTextoCampo(c.nome_condominio, parsed.nomeCondominio));
  const temQuadra = Boolean(coalesceTextoCampo(c.quadra, parsed.quadra));
  const temLote = Boolean(coalesceTextoCampo(c.lote, parsed.lote));
  const temRede = Boolean(
    String((c as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? '').trim(),
  );
  return !temCondominio || !temQuadra || !temLote || !temRede || partesTituloCard(titulo) < 3;
}

function chaveIrmaosProcessoCard(c: Record<string, unknown>): string {
  const proc = String((c as { processo_step_one_id?: string | null }).processo_step_one_id ?? '').trim();
  if (proc) return `proc:${proc}`;
  const proj = String((c as { projeto_id?: string | null }).projeto_id ?? '').trim();
  if (proj) return `proj:${proj}`;
  return '';
}

function cardNativoPrecisaIrmaosProjeto(c: Record<string, unknown>): boolean {
  if (!chaveIrmaosProcessoCard(c)) return false;
  const titulo = String(c.titulo ?? '').trim();
  const parsed = parseCamposDoTituloCard(titulo);
  const temCondominio = Boolean(coalesceTextoCampo(c.nome_condominio, parsed.nomeCondominio));
  const temQuadra = Boolean(coalesceTextoCampo(c.quadra, parsed.quadra));
  const temLote = Boolean(coalesceTextoCampo(c.lote, parsed.lote));
  const temRede = Boolean(
    String((c as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? '').trim(),
  );
  return !temCondominio || !temQuadra || !temLote || !temRede || partesTituloCard(titulo) < 3;
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
    titulo: (() => {
      if (!tituloDest) return tituloFonte;
      if (!tituloFonte) return tituloDest;
      return partesTituloCard(tituloDest) >= partesTituloCard(tituloFonte)
        ? tituloDest
        : tituloFonte;
    })(),
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
  porChaveProcesso: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  const chave = chaveIrmaosProcessoCard(card);
  if (!chave) return card;
  const fonte = porChaveProcesso.get(chave);
  if (!fonte) return card;

  const nomeCard = String(
    coalesceTextoCampo(
      card.nome_condominio,
      parseCamposDoTituloCard(String(card.titulo ?? '')).nomeCondominio,
    ) ?? '',
  )
    .trim()
    .toLowerCase();
  const nomeFonte = String(
    coalesceTextoCampo(
      fonte.nome_condominio,
      parseCamposDoTituloCard(String(fonte.titulo ?? '')).nomeCondominio,
    ) ?? '',
  )
    .trim()
    .toLowerCase();
  if (nomeCard && nomeFonte && nomeCard !== nomeFonte) return card;

  return mesclarCamposDeFonte(card, fonte);
}

async function fetchCamposIrmaosPorProjeto(
  supabase: SupabaseClient,
  cards: Array<Record<string, unknown>>,
): Promise<Map<string, Record<string, unknown>>> {
  const chaves = [...new Set(cards.map((c) => chaveIrmaosProcessoCard(c)).filter(Boolean))];
  const out = new Map<string, Record<string, unknown>>();
  if (chaves.length === 0) return out;

  const processoIds = chaves.filter((k) => k.startsWith('proc:')).map((k) => k.slice(5));
  const projetoIds = chaves.filter((k) => k.startsWith('proj:')).map((k) => k.slice(5));

  const chunkSize = 100;
  const rows: Record<string, unknown>[] = [];

  for (let i = 0; i < processoIds.length; i += chunkSize) {
    const chunk = processoIds.slice(i, i + chunkSize);
    const { data } = await supabase
      .from('kanban_cards')
      .select(
        'id, projeto_id, processo_step_one_id, titulo, nome_condominio, quadra, lote, rede_franqueado_id, data_followup, data_reuniao',
      )
      .in('processo_step_one_id', chunk);
    rows.push(...((data ?? []) as Record<string, unknown>[]));
  }

  for (let i = 0; i < projetoIds.length; i += chunkSize) {
    const chunk = projetoIds.slice(i, i + chunkSize);
    const { data } = await supabase
      .from('kanban_cards')
      .select(
        'id, projeto_id, processo_step_one_id, titulo, nome_condominio, quadra, lote, rede_franqueado_id, data_followup, data_reuniao',
      )
      .in('projeto_id', chunk)
      .is('processo_step_one_id', null);
    rows.push(...((data ?? []) as Record<string, unknown>[]));
  }

  for (const chave of chaves) {
    const siblings = rows.filter((r) => chaveIrmaosProcessoCard(r) === chave);
    let agg: Record<string, unknown> = {};
    for (const sib of siblings) {
      agg = mesclarCamposDeFonte(agg, sib);
    }
    if (Object.keys(agg).length > 0) out.set(chave, agg);
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

/** Enriquecimento de bolinhas: service role evita RLS bloquear filhos de outros funis. */
export function supabaseParaEnriquecerParalelas(userClient: SupabaseClient): SupabaseClient {
  const admin = tryCreateAdminClient();
  if (!admin) {
    const msg =
      '[kanban] enrich paralelas: service role indisponível — filhos cross-funil dependem da RPC kanban_filhos_paralelas_por_pais (migration 473)';
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
      console.error(msg);
    } else {
      console.warn(msg);
    }
    return userClient;
  }
  return admin;
}

/**
 * Carrega fases e cards do kanban pelo nome (`kanbans.nome`).
 * Default `mode: 'lean'`: só ativos (`status=ativo`, não arquivado, não concluído).
 * Arquivados / concluídos: `mode: 'arquivados' | 'concluidos'` (lazy no board) ou `full`.
 * Sem `userId` (ex.: visitante com service role): não filtra por franqueado e assume visão ampla.
 *
 * Se não houver linhas em `kanban_cards` para o kanban, os cards vêm de
 * `v_processo_como_kanban_cards` (processo_step_one) com `origem: 'legado'`.
 * Híbridos Contabilidade/Crédito Obra mantêm a view no lean; demais nativos pulam a view.
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
    ? supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
    : Promise.resolve({ data: null as { role?: string | null } | null });

  const [profileRes, kanban] = await Promise.all([
    profilePromise,
    resolveKanbanAtivoCached(supabase, kanbanNomeDb),
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

  const deferEnrichments = options?.deferBoardEnrichments === true;
  const forceSkipLegadoView = options?.forceSkipLegadoView === true;
  const useFastPaint = deferEnrichments && isFastPaintKanban(kanbanNomeDb) && wantAtivos;
  const skipCalculadora =
    options?.skipCalculadoraSlaEnrich === true || deferEnrichments;
  const timer = createKanbanSnapshotTimer(kanbanNomeDb, useFastPaint ? 'fast' : snapshotMode);
  timer.mark('auth+kanban');

  if (useFastPaint) {
    type KanbanCardRow = Record<string, unknown>;

    const buildFastCardsQuery = async (select: string) => {
      let q = supabase
        .from('kanban_cards')
        .select(select)
        .eq('kanban_id', kanban.id)
        .eq('status', 'ativo')
        .order('ordem_coluna', { ascending: true })
        .order('created_at', { ascending: false })
        .or('concluido.eq.false,concluido.is.null')
        .or('arquivado.eq.false,arquivado.is.null');
      if (userId && !veTodosCards) q = q.eq('franqueado_id', userId);
      const { data, error } = await q;
      return {
        data: (data ?? null) as KanbanCardRow[] | null,
        error: error ? { message: error.message } : null,
      };
    };

    const [fases, cardsRes] = await Promise.all([
      fetchKanbanFasesAtivasCached(supabase, kanbanIdStr),
      runKanbanCardSelectBoardFast<KanbanCardRow[]>((select) => buildFastCardsQuery(select)),
    ]);
    timer.mark('fases+cards-fast');

    const cardsNativoRaw = ((cardsRes.data ?? []) as KanbanCardRow[]).map((c) =>
      mapNativoFastRow(c, kanbanIdStr),
    );
    const rawRows = (cardsRes.data ?? []) as Record<string, unknown>[];
    const [tagsByCardId, cardsNativo] = await Promise.all([
      fetchKanbanTagsByCardIds(
        supabase,
        cardsNativoRaw.map((c) => c.id),
      ),
      enrichFastPaintCardsParaExibicao(
        supabase,
        kanbanIdStr,
        kanbanNomeDb,
        rawRows,
        cardsNativoRaw,
      ),
    ]);
    const cardsComTags = aplicarTagsKanbanCards(cardsNativo, tagsByCardId);
    timer.mark('tags+franqueado-fast');
    const faseIdsOrfas = cardsComTags.map((c) => c.fase_id);
    const fasesComOrfas = await augmentKanbanFasesComFasesDosCards(
      supabase,
      kanbanIdStr,
      fases,
      faseIdsOrfas,
    );
    timer.mark('fases-orfas');
    timer.end(`${cardsComTags.length} cards`);

    return {
      kanban: { id: kanbanIdStr },
      fases: fasesComOrfas,
      cards: cardsComTags,
      cardsConcluidos: [],
      role,
      isAdmin,
      snapshotMode,
    };
  }

  const [fases, nativeCountResult] = await Promise.all([
    fetchKanbanFasesAtivasCached(supabase, kanbanIdStr),
    supabase
      .from('kanban_cards')
      .select('*', { count: 'exact', head: true })
      .eq('kanban_id', kanban.id),
  ]);

  timer.mark('fases+count');

  /** Funis nativos: sempre tenta ler `kanban_cards` (count com RLS pode ser 0 mesmo com linhas). */
  const hasNativo = (nativeCountResult.count ?? 0) > 0 || sempreNativo;

  /**
   * Arquivados/concluídos: só nativos no filtro STATUS.
   * Nativos puros: skip view.
   * Híbridos Contabilidade/Crédito Obra: mantêm view no lean para lacunas (proteção).
   * Fast paint / enrichment client: skip view legado em Operações já migrado.
   */
  const skipLegadoView =
    forceSkipLegadoView ||
    snapshotMode === 'arquivados' ||
    snapshotMode === 'concluidos' ||
    sempreNativo ||
    (hasNativo && !hibridoComView) ||
    (deferEnrichments && isFastPaintKanban(kanbanNomeDb) && hasNativo);

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

  const isFunilOperacoes = kanbanIdStr === KANBAN_IDS.OPERACOES;

  const cardsNativosRaw = [
    ...((cardsRaw ?? []) as Record<string, unknown>[]),
    ...((conclRaw ?? []) as Record<string, unknown>[]),
    ...((arquivRaw ?? []) as Record<string, unknown>[]),
  ];

  const allNativeCards = cardsNativosRaw as {
    id?: string;
    projeto_id?: string | null;
    processo_step_one_id?: string | null;
  }[];

  const processoIdsCampos = new Set<string>();
  for (const c of allNativeCards) {
    const id = String(c.id ?? '').trim();
    const pid = String(c.projeto_id ?? '').trim();
    const procId = String(c.processo_step_one_id ?? '').trim();
    if (id) processoIdsCampos.add(id);
    if (pid) processoIdsCampos.add(pid);
    if (procId) processoIdsCampos.add(procId);
  }

  const cardsParaAncestrais = cardsNativosRaw.filter(cardNativoPrecisaCamposAncestrais);
  const cardsParaIrmaos = isFunilOperacoes
    ? []
    : cardsNativosRaw.filter(cardNativoPrecisaIrmaosProjeto);

  const [
    franqueadoMaps,
    processoCamposMap,
    ancestraisMap,
    irmaosProjetoMap,
  ] = await Promise.all([
    resolveNativeFranqueadoMaps(supabase, cardsRaw, conclRaw, arquivRaw),
    processoIdsCampos.size > 0
      ? fetchProcessoCamposPorIds(supabase, [...processoIdsCampos])
      : Promise.resolve(new Map<string, ProcessoCamposRow>()),
    cardsParaAncestrais.length > 0
      ? fetchCamposAncestraisPorCard(supabase, cardsParaAncestrais)
      : Promise.resolve(new Map<string, Record<string, unknown>>()),
    cardsParaIrmaos.length > 0
      ? fetchCamposIrmaosPorProjeto(supabase, cardsParaIrmaos)
      : Promise.resolve(new Map<string, Record<string, unknown>>()),
  ]);

  const {
    redeNomeDiretoMap,
    franqueadoNomePorCardId,
    nFranquiaPorCardId,
    nFranquiaByRedeId,
  } = franqueadoMaps;

  const headerLoteador = precisaHeaderLoteadorNoBoard(kanbanIdStr, kanbanNomeDb);
  const loteadorIdPorCard = headerLoteador
    ? await resolverRedeLoteadorIdsPorCards(supabase, cardsNativosRaw)
    : new Map<string, string>();
  const loteadorPorId = headerLoteador
    ? await carregarLoteadorHeaderPorIds(supabase, [...loteadorIdPorCard.values()])
    : new Map<string, LoteadorHeaderRow>();

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
    const filhoBastao = isFilhoBastaoCard(c);
    const cMerged = filhoBastao
      ? c
      : isFunilOperacoes
        ? mesclarCamposComAncestrais(c, ancestraisMap)
        : mesclarCamposComProjetoIrmaos(
            mesclarCamposComAncestrais(c, ancestraisMap),
            irmaosProjetoMap,
          );
    const fid = String(cMerged.franqueado_id ?? '');
    const redeId = String((cMerged as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? '').trim();
    const cardId = String(cMerged.id ?? '');
    const tituloRaw = String(cMerged.titulo ?? '');
    const procStepOneId = String(
      (cMerged as { processo_step_one_id?: string | null }).processo_step_one_id ?? '',
    ).trim();
    const proc =
      (procStepOneId ? processoCamposMap.get(procStepOneId) : undefined) ??
      (!procStepOneId && processoCamposMap.has(cardId) ? processoCamposMap.get(cardId) : undefined);
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
    const quadra = isFunilOperacoes
      ? coalesceTextoCampo(
          (cMerged as { quadra?: string | null }).quadra,
          parsedTitulo.quadra,
        )
      : coalesceTextoCampo(
          (cMerged as { quadra?: string | null }).quadra,
          proc?.quadra,
          parsedTitulo.quadra,
          quadraLoteProc ? quadraLoteProc.split('/')[0] : null,
        );
    const lote = isFunilOperacoes
      ? coalesceTextoCampo(
          (cMerged as { lote?: string | null }).lote,
          parsedTitulo.lote,
        )
      : coalesceTextoCampo(
          (cMerged as { lote?: string | null }).lote,
          proc?.lote,
          parsedTitulo.lote,
          quadraLoteProc ? quadraLoteProc.split('/')[1] : null,
        );
    const nFranquiaCard = redeId
      ? nFranquiaByRedeId.get(redeId)
      : nFranquiaPorCardId.get(cardId) ?? extrairNumeroFranquiaDoTitulo(tituloRaw);
    const nomeFranqueadoCard = redeId
      ? redeNomeDiretoMap.get(redeId)
      : franqueadoNomePorCardId.get(cardId);
    const tituloCalc = montarTituloCardSync({
      nFranquia: nFranquiaCard,
      nomeFranqueado: nomeFranqueadoCard,
      nomeCondominio,
      quadra,
      lote,
      tituloFallback: tituloRaw,
    });

    let tituloExibicao = filhoBastao && tituloRaw
      ? escolherTituloExibicaoCard(tituloRaw, null, nFranquiaCard, nomeFranqueadoCard)
      : escolherTituloExibicaoCard(
          tituloRaw,
          tituloCalc,
          nFranquiaCard,
          nomeFranqueadoCard,
          { nomeCondominio, quadra, lote },
        );
    let subtituloCard: string | null = null;
    let profilesLinha: KanbanCardBrief['profiles'] =
      redeId && redeNomeDiretoMap.has(redeId)
        ? { full_name: redeNomeDiretoMap.get(redeId) ?? null }
        : !filhoBastao && franqueadoNomePorCardId.has(cardId)
          ? { full_name: franqueadoNomePorCardId.get(cardId) ?? null }
          : null;

    const redeLoteadorId =
      loteadorIdPorCard.get(cardId) ??
      String((cMerged as { rede_loteador_id?: string | null }).rede_loteador_id ?? '').trim();
    const rl = redeLoteadorId ? loteadorPorId.get(redeLoteadorId) : undefined;
    if (isFunilLoteadores || rl) {
      const nomeHeader = nomeResponsavelHeaderLoteador(rl);
      const condominioIdCard = String(
        (cMerged as { condominio_id?: string | null }).condominio_id ?? '',
      ).trim();
      tituloExibicao =
        tituloExibicaoCardLoteadores(
          {
            titulo: tituloRaw,
            nome_condominio: (cMerged as { nome_condominio?: string | null }).nome_condominio,
          },
          rl,
          {
            condominioNomeTabela: condominioIdCard
              ? condominioNomePorId.get(condominioIdCard) ?? null
              : null,
          },
        ) ?? tituloExibicao;
      subtituloCard = subtituloCardLoteadores(rl?.nome, nomeHeader, {
        titulo: tituloExibicao,
        nomeCondominio: (cMerged as { nome_condominio?: string | null }).nome_condominio,
      });
      profilesLinha = nomeHeader ? { full_name: nomeHeader } : null;
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

  /** Legado/shadow: `processo_step_one.etapa_painel` alinha coluna. Operações nativo usa `fase_id` do card. */
  let cardsLegadoReconciliados = cardsLegado;
  if (!isFunilOperacoes) {
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
    cardsLegadoReconciliados = aplicarFasePorEtapaPainelEmLote(
      cardsLegado,
      etapaPorProcesso,
      slugParaFaseId,
    );
  }

  const legadoPorId = new Map(cardsLegadoReconciliados.map((c) => [c.id, c]));
  const mesclarDatasLegado = (lista: KanbanCardBrief[]) =>
    lista.map((c) => coalesceDatasCardBrief(c, legadoPorId.get(c.id)));

  cardsNativo = mesclarDatasLegado(cardsNativo);
  cardsConcluidos = mesclarDatasLegado(cardsConcluidos);
  cardsArquivadosNativo = mesclarDatasLegado(cardsArquivadosNativo);

  const todosParaEnrichDatas = [...cardsNativo, ...cardsConcluidos, ...cardsArquivadosNativo];
  if (todosParaEnrichDatas.length > 0) {
    const [enrichedDatas, enrichedFollowup] = await Promise.all([
      enrichCardsDatasFromProcesso(supabase, todosParaEnrichDatas),
      enrichCardsFollowupFromAtividades(supabase, todosParaEnrichDatas),
    ]);
    const porId = new Map<string, KanbanCardBrief>();
    for (const c of enrichedDatas) porId.set(c.id, c);
    for (const c of enrichedFollowup) {
      const base = porId.get(c.id);
      porId.set(c.id, base ? { ...base, data_followup: base.data_followup ?? c.data_followup } : c);
    }
    cardsNativo = cardsNativo.map((c) => porId.get(c.id) ?? c);
    cardsConcluidos = cardsConcluidos.map((c) => porId.get(c.id) ?? c);
    cardsArquivadosNativo = cardsArquivadosNativo.map((c) => porId.get(c.id) ?? c);
  }

  const idsComLinhaNativa = new Set([
    ...cardsNativo.map((c) => c.id),
    ...cardsConcluidos.map((c) => c.id),
    ...cardsArquivadosNativo.map((c) => c.id),
  ]);
  let processoIdsCobertosPorNativo = new Set<string>();
  if (!skipLegadoView) {
    processoIdsCobertosPorNativo = await buildProcessoIdsCobertosPorNativo(
      supabase,
      [...cardsNativo, ...cardsArquivadosNativo],
    );
  }

  // Nativo prevalece quando existe linha; legado só preenche lacunas (sem duplicata por id/processo).
  let cards = [
    ...cardsNativo,
    ...cardsArquivadosNativo,
    ...cardsLegadoReconciliados.filter(
      (c) =>
        !idsComLinhaNativa.has(c.id) && !processoIdsCobertosPorNativo.has(c.id),
    ),
  ].filter((c) => {
    const id = String(c.id ?? '').trim();
    return Boolean(id);
  });
  cards = dedupeKanbanCardsPreferindoNativo(cards);

  const allCardIds = [...new Set([...cards.map((c) => c.id), ...cardsConcluidos.map((c) => c.id)].filter(Boolean))];
  const faseIdsOrfas = [...cards.map((c) => c.fase_id), ...cardsConcluidos.map((c) => c.fase_id)];

  if (!deferEnrichments && allCardIds.length > 0) {
    const supabaseEnrich = supabaseParaEnriquecerParalelas(supabase);
    [cards, cardsConcluidos] = await Promise.all([
      enrichCardsParalelasContext(supabaseEnrich, kanbanIdStr, cards, supabase, kanbanNomeDb),
      enrichCardsParalelasContext(supabaseEnrich, kanbanIdStr, cardsConcluidos, supabase, kanbanNomeDb),
    ]);
  }

  let fasesComOrfas = await augmentKanbanFasesComFasesDosCards(
    supabase,
    kanbanIdStr,
    fases,
    faseIdsOrfas,
  );

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
    const byCardId = await fetchKanbanTagsByCardIds(supabase, allCardIds);
    const cardsTagged = aplicarTagsKanbanCards(cards, byCardId);
    const cardsConcluidosTagged = aplicarTagsKanbanCards(cardsConcluidos, byCardId);

    if (deferEnrichments) {
      return {
        kanban: { id: kanbanIdStr },
        fases: fasesComOrfas,
        cards: cardsTagged,
        cardsConcluidos: cardsConcluidosTagged,
        role,
        isAdmin,
        snapshotMode,
      };
    }

    const [cardsComResp, cardsConcluidosComResp] = await Promise.all([
      enrichCardsComResponsavelFase(supabase, cardsTagged),
      enrichCardsComResponsavelFase(supabase, cardsConcluidosTagged),
    ]);

    const cardsComCalculadora = skipCalculadora
      ? cardsComResp
      : await enrichCardsComCalculadoraSlaEstourado(
          supabase,
          cardsComResp,
          kanbanIdStr,
          fasesComOrfas,
        );

    return {
      kanban: { id: kanbanIdStr },
      fases: fasesComOrfas,
      cards: cardsComCalculadora,
      cardsConcluidos: cardsConcluidosComResp,
      role,
      isAdmin,
      snapshotMode,
    };
  }

  if (deferEnrichments) {
    return {
      kanban: { id: kanbanIdStr },
      fases: fasesComOrfas,
      cards,
      cardsConcluidos,
      role,
      isAdmin,
      snapshotMode,
    };
  }

  const [cardsComResp, cardsConcluidosComResp] = await Promise.all([
    enrichCardsComResponsavelFase(supabase, cards),
    enrichCardsComResponsavelFase(supabase, cardsConcluidos),
  ]);

  const cardsComCalculadora = skipCalculadora
    ? cardsComResp
    : await enrichCardsComCalculadoraSlaEstourado(
        supabase,
        cardsComResp,
        kanbanIdStr,
        fasesComOrfas,
      );

  return {
    kanban: { id: kanbanIdStr },
    fases: fasesComOrfas,
    cards: cardsComCalculadora,
    cardsConcluidos: cardsConcluidosComResp,
    role,
    isAdmin,
    snapshotMode,
  };
}

type NativeFranqueadoMaps = {
  redeNomeDiretoMap: Map<string, string>;
  franqueadoNomePorCardId: Map<string, string>;
  nFranquiaPorCardId: Map<string, string>;
  nFranquiaByRedeId: Map<string, string>;
};

/** Resolve nomes de franqueado para cards nativos (rede direta + fallback processo/título). */
async function resolveNativeFranqueadoMaps(
  supabase: SupabaseClient,
  cardsRaw: unknown[],
  conclRaw: unknown[],
  arquivRaw: unknown[],
): Promise<NativeFranqueadoMaps> {
  const redeNomeDiretoMap = new Map<string, string>();
  const franqueadoNomePorCardId = new Map<string, string>();
  const nFranquiaPorCardId = new Map<string, string>();
  const nFranquiaByRedeId = new Map<string, string>();

  const redeIdsDiretos = [
    ...new Set([
      ...(cardsRaw?.map((c) => (c as { rede_franqueado_id?: string | null }).rede_franqueado_id) ?? []).filter(Boolean),
      ...(conclRaw?.map((c) => (c as { rede_franqueado_id?: string | null }).rede_franqueado_id) ?? []).filter(Boolean),
      ...(arquivRaw?.map((c) => (c as { rede_franqueado_id?: string | null }).rede_franqueado_id) ?? []).filter(Boolean),
    ]),
  ] as string[];

  const redeById = new Map<string, string>();
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

  for (const id of redeIdsDiretos) {
    const nome = redeById.get(id);
    if (nome) redeNomeDiretoMap.set(id, nome);
  }

  const allNativeCards = [
    ...((cardsRaw ?? []) as {
      id?: string;
      projeto_id?: string | null;
      rede_franqueado_id?: string | null;
      titulo?: string | null;
      nome_condominio?: string | null;
      processo_step_one_id?: string | null;
    }[]),
    ...((conclRaw ?? []) as {
      id?: string;
      projeto_id?: string | null;
      rede_franqueado_id?: string | null;
      titulo?: string | null;
      nome_condominio?: string | null;
      processo_step_one_id?: string | null;
    }[]),
    ...((arquivRaw ?? []) as {
      id?: string;
      projeto_id?: string | null;
      rede_franqueado_id?: string | null;
      titulo?: string | null;
      nome_condominio?: string | null;
      processo_step_one_id?: string | null;
    }[]),
  ];
  const cardsSemRede = allNativeCards.filter((c) => !String(c.rede_franqueado_id ?? '').trim());

  if (cardsSemRede.length === 0) {
    return { redeNomeDiretoMap, franqueadoNomePorCardId, nFranquiaPorCardId, nFranquiaByRedeId };
  }

  const processoIdsToFetch = new Set<string>();
  const numerosFranquia = new Set<string>();

  for (const c of cardsSemRede) {
    const id = String(c.id ?? '').trim();
    const pid = String(c.projeto_id ?? '').trim();
    const procId = String(c.processo_step_one_id ?? '').trim();
    if (id) processoIdsToFetch.add(id);
    if (pid) processoIdsToFetch.add(pid);
    if (procId) processoIdsToFetch.add(procId);
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
          const nomes = [String(c.nome_condominio ?? '').trim(), String(c.titulo ?? '').trim()].filter(Boolean);
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

  return { redeNomeDiretoMap, franqueadoNomePorCardId, nFranquiaPorCardId, nFranquiaByRedeId };
}

function mapNativeRowToEnrichmentBrief(
  row: Record<string, unknown>,
  kanbanId: string,
): KanbanCardBrief {
  return {
    id: String(row.id ?? ''),
    titulo: String(row.titulo ?? ''),
    status: String(row.status ?? ''),
    created_at: String(row.created_at ?? ''),
    fase_id: String(row.fase_id ?? ''),
    franqueado_id: String(row.franqueado_id ?? ''),
    kanban_id: kanbanId,
    projeto_id: (row.projeto_id as string | null) ?? null,
    arquivado: Boolean(row.arquivado),
    concluido: Boolean(row.concluido),
    concluido_em: row.concluido_em != null ? String(row.concluido_em) : null,
    origem: 'nativo',
    entered_fase_at: row.entered_fase_at != null ? String(row.entered_fase_at) : null,
    sla_iniciado_em: row.sla_iniciado_em != null ? String(row.sla_iniciado_em) : null,
    acoplamento_concluido: Boolean(row.acoplamento_concluido),
    acoplamento_filho_fase_nome: (row.acoplamento_filho_fase_nome as string | null) ?? null,
    acoplamento_filho_fase_slug: (row.acoplamento_filho_fase_slug as string | null) ?? null,
    credito_terreno_ok: Boolean(row.credito_terreno_ok),
    contabilidade_ok: Boolean(row.contabilidade_ok),
    capital_ok: Boolean(row.capital_ok),
    juridico_ok: Boolean(row.juridico_ok),
    credito_obra_ok: Boolean(row.credito_obra_ok),
    projetos_legais_ok: (row.projetos_legais_ok as boolean | null) ?? null,
    projetos_locais_ok: (row.projetos_locais_ok as boolean | null) ?? null,
    proxima_atividade: (row.proxima_atividade as string | null) ?? null,
    prazo_atividade: dataIsoParaInput(row.prazo_atividade),
  };
}

/**
 * Enriquecimentos adiados — chamado pelo client após paint inicial.
 * Portfólio/Operações/Loteadores: paint inicial já traz título, franqueado e tags;
 * bootstrap leve (paralelas, responsável, calculadora).
 * Demais funis: só paralelas + responsável + calculadora.
 */
export async function fetchKanbanBoardEnrichmentPatches(
  supabase: SupabaseClient,
  kanbanNomeDb: string,
  kanbanId: string,
  userId: string,
): Promise<Record<string, Partial<KanbanCardBrief>>> {
  const kid = String(kanbanId ?? '').trim();
  if (!kid) return {};

  let veTodosCards = false;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  const role = (profile?.role as string) ?? 'frank';
  const accessRole = normalizeAccessRole(profile?.role);
  const isAdmin = accessRole === 'admin' || accessRole === 'team';
  veTodosCards = isAdmin || role === 'consultor' || role === 'supervisor';

  type KanbanCardRow = Record<string, unknown>;
  let q = supabase
    .from('kanban_cards')
    .select(
      'id, titulo, status, created_at, fase_id, franqueado_id, kanban_id, projeto_id, arquivado, concluido, concluido_em, entered_fase_at, sla_iniciado_em, acoplamento_concluido, acoplamento_filho_fase_nome, acoplamento_filho_fase_slug, credito_terreno_ok, contabilidade_ok, capital_ok, juridico_ok, credito_obra_ok, projetos_legais_ok, projetos_locais_ok, obra_ok, proxima_atividade, prazo_atividade',
    )
    .eq('kanban_id', kid)
    .eq('status', 'ativo')
    .or('concluido.eq.false,concluido.is.null')
    .or('arquivado.eq.false,arquivado.is.null');
  if (!veTodosCards) q = q.eq('franqueado_id', userId);

  const { data: rows, error } = await q;
  if (error || !rows?.length) return {};

  let cards = (rows as KanbanCardRow[]).map((r) => mapNativeRowToEnrichmentBrief(r, kid));
  const fases = await fetchKanbanFasesAtivasCached(supabase, kid);

  const supabaseEnrich = supabaseParaEnriquecerParalelas(supabase);
  cards = await enrichCardsParalelasContext(supabaseEnrich, kid, cards, supabase, kanbanNomeDb);
  cards = await enrichCardsComResponsavelFase(supabase, cards);
  cards = await enrichCardsComCalculadoraSlaEstourado(supabase, cards, kid, fases);

  const patches: Record<string, Partial<KanbanCardBrief>> = {};
  for (const c of cards) {
    const patch = pickDeferredEnrichmentFields(c);
    if (Object.keys(patch).length > 0) patches[c.id] = patch;
  }
  return mergeTagsIntoEnrichmentPatches(supabase, patches, cards.map((c) => c.id));
}

async function mergeTagsIntoEnrichmentPatches(
  supabase: SupabaseClient,
  patches: Record<string, Partial<KanbanCardBrief>>,
  cardIds: string[],
): Promise<Record<string, Partial<KanbanCardBrief>>> {
  const tagsByCardId = await fetchKanbanTagsByCardIds(supabase, cardIds);
  for (const id of cardIds) {
    const tags = tagsByCardId.get(id) ?? [];
    patches[id] = { ...(patches[id] ?? {}), tagsCard: tags };
  }
  return patches;
}
