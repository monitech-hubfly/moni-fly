import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanCardBrief } from '@/components/kanban-shared/types';
import { compareRedePorNFranquia } from '@/lib/rede-franqueados';
import { normalizarSlaTipo } from '@/lib/dias-uteis';
import {
  buscarProfilesFranqueadoPorRedeIdsBatch,
  enrichCardsComResponsavelFase,
  isKanbanFunilStepOneId,
} from '@/lib/kanban/responsavel-fase-checklist';
import { fetchPainelChamados } from '@/lib/kanban/fetch-painel-chamados';
import { computeGargaloRankingRede } from '@/lib/kanban/pipeline-franqueadora-compute';
import type { PainelFaseDTO } from '@/lib/kanban/painel-performance-types';
import type {
  PipelineCardRow,
  PipelineCardsDataset,
  PipelineCardsViewMode,
  PipelineFranqueadoUnidade,
  PipelineFranqueadoraEnrichment,
} from '@/lib/kanban/pipeline-cards-types';

const CARD_SELECT_BASE = `
  id,
  titulo,
  kanban_id,
  fase_id,
  rede_franqueado_id,
  projeto_id,
  origem_card_id,
  processo_step_one_id,
  created_at,
  updated_at,
  entered_fase_at,
  sla_iniciado_em,
  alvara_url,
  docs_terreno_url,
  arquivado,
  concluido,
  status,
  kanbans ( nome ),
  kanban_fases ( nome, slug, ordem, sla_dias, sla_tipo, fase_conversao ),
  rede_franqueados ( n_franquia, nome_completo, ordem ),
  projeto_negocio ( titulo )
`;

const CARD_SELECT_WITH_CONTRATO = `${CARD_SELECT_BASE.trim()},
  contrato_assinado,
  contrato_assinado_em
`;

const CARD_SELECT_WITH_FUNIL = `${CARD_SELECT_BASE.trim()},
  opcao_assinada,
  opcao_assinada_em,
  comite_aprovado,
  comite_aprovado_em,
  contrato_assinado,
  contrato_assinado_em,
  prefeitura_aprovada,
  prefeitura_aprovada_em,
  obra_iniciada,
  obra_iniciada_em,
  obra_finalizada,
  obra_finalizada_em
`;

const CARD_SELECT_SEM_PROJETO = `
  id,
  titulo,
  kanban_id,
  fase_id,
  rede_franqueado_id,
  origem_card_id,
  processo_step_one_id,
  created_at,
  updated_at,
  entered_fase_at,
  sla_iniciado_em,
  alvara_url,
  docs_terreno_url,
  arquivado,
  concluido,
  status,
  kanbans ( nome ),
  kanban_fases ( nome, slug, ordem, sla_dias, sla_tipo, fase_conversao ),
  rede_franqueados ( n_franquia, nome_completo, ordem )
`.trim();

type RawCard = Record<string, unknown>;

function relOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function mapPipelineCardRow(raw: RawCard): PipelineCardRow | null {
  const id = String(raw.id ?? '').trim();
  if (!id) return null;

  const kanban = relOne(raw.kanbans as { nome?: string | null } | { nome?: string | null }[] | null);
  const fase = relOne(
    raw.kanban_fases as
      | { nome?: string | null; slug?: string | null; ordem?: number | null; sla_dias?: number | null; sla_tipo?: string | null; fase_conversao?: boolean | null }
      | Array<{ nome?: string | null; slug?: string | null; ordem?: number | null; sla_dias?: number | null; sla_tipo?: string | null; fase_conversao?: boolean | null }>
      | null,
  );
  const rede = relOne(
    raw.rede_franqueados as
      | { n_franquia?: string | null; nome_completo?: string | null; ordem?: number | null }
      | Array<{ n_franquia?: string | null; nome_completo?: string | null; ordem?: number | null }>
      | null,
  );
  const projeto = relOne(
    raw.projeto_negocio as { titulo?: string | null } | Array<{ titulo?: string | null }> | null,
  );
  const projetoId = raw.projeto_id != null ? String(raw.projeto_id).trim() : '';

  const row: PipelineCardRow = {
    id,
    titulo: String(raw.titulo ?? '').trim() || '(sem título)',
    kanban_id: String(raw.kanban_id ?? ''),
    kanban_nome: String(kanban?.nome ?? '').trim() || 'Kanban',
    fase_id: String(raw.fase_id ?? ''),
    fase_nome: String(fase?.nome ?? '').trim() || '—',
    fase_slug: fase?.slug != null ? String(fase.slug) : null,
    fase_ordem: Number(fase?.ordem ?? 0),
    fase_sla_dias: fase?.sla_dias != null ? Number(fase.sla_dias) : null,
    fase_sla_tipo: normalizarSlaTipo(fase?.sla_tipo),
    fase_conversao: Boolean(fase?.fase_conversao),
    rede_franqueado_id: raw.rede_franqueado_id != null ? String(raw.rede_franqueado_id) : null,
    n_franquia: rede?.n_franquia != null ? String(rede.n_franquia) : null,
    franqueado_nome: rede?.nome_completo != null ? String(rede.nome_completo) : null,
    rede_ordem: Number(rede?.ordem ?? 0),
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? raw.created_at ?? ''),
    entered_fase_at: raw.entered_fase_at != null ? String(raw.entered_fase_at) : null,
    sla_iniciado_em: raw.sla_iniciado_em != null ? String(raw.sla_iniciado_em) : null,
    alvara_url: raw.alvara_url != null ? String(raw.alvara_url) : null,
    docs_terreno_url: raw.docs_terreno_url != null ? String(raw.docs_terreno_url) : null,
    arquivado: Boolean(raw.arquivado),
    concluido: Boolean(raw.concluido),
    origem: 'nativo',
    responsavel_fase_id: null,
    responsavel_fase_nome: null,
    projeto_id: projetoId || null,
    projeto_titulo: projeto?.titulo != null ? String(projeto.titulo).trim() || null : null,
    origem_card_id: raw.origem_card_id != null ? String(raw.origem_card_id).trim() || null : null,
    processo_step_one_id:
      raw.processo_step_one_id != null ? String(raw.processo_step_one_id).trim() || null : null,
  };

  if ('opcao_assinada' in raw) {
    row.opcao_assinada = raw.opcao_assinada === true;
    row.opcao_assinada_em = raw.opcao_assinada_em != null ? String(raw.opcao_assinada_em) : null;
  }
  if ('comite_aprovado' in raw) {
    row.comite_aprovado = raw.comite_aprovado === true;
    row.comite_aprovado_em = raw.comite_aprovado_em != null ? String(raw.comite_aprovado_em) : null;
  }
  if ('contrato_assinado' in raw) {
    row.contrato_assinado = raw.contrato_assinado === true;
    row.contrato_assinado_em =
      raw.contrato_assinado_em != null ? String(raw.contrato_assinado_em) : null;
  }
  if ('prefeitura_aprovada' in raw) {
    row.prefeitura_aprovada = raw.prefeitura_aprovada === true;
    row.prefeitura_aprovada_em =
      raw.prefeitura_aprovada_em != null ? String(raw.prefeitura_aprovada_em) : null;
  }
  if ('obra_iniciada' in raw) {
    row.obra_iniciada = raw.obra_iniciada === true;
    row.obra_iniciada_em = raw.obra_iniciada_em != null ? String(raw.obra_iniciada_em) : null;
  }
  if ('obra_finalizada' in raw) {
    row.obra_finalizada = raw.obra_finalizada === true;
    row.obra_finalizada_em = raw.obra_finalizada_em != null ? String(raw.obra_finalizada_em) : null;
  }

  return row;
}

function toKanbanCardBrief(row: PipelineCardRow): KanbanCardBrief {
  return {
    id: row.id,
    titulo: row.titulo,
    status: 'ativo',
    created_at: row.created_at,
    fase_id: row.fase_id,
    franqueado_id: '',
    kanban_id: row.kanban_id,
    entered_fase_at: row.entered_fase_at,
    sla_iniciado_em: row.sla_iniciado_em,
    alvara_url: row.alvara_url,
    docs_terreno_url: row.docs_terreno_url,
    arquivado: row.arquivado,
    concluido: row.concluido,
    origem: 'nativo',
  };
}

async function enriquecerResponsavelPipelineCards(
  supabase: SupabaseClient,
  cards: PipelineCardRow[],
): Promise<PipelineCardRow[]> {
  if (cards.length === 0) return cards;

  const stepOneNomeRedePorCardId = new Map<string, string>();
  const redeIdsToResolve = new Set<string>();

  for (const row of cards) {
    if (!isKanbanFunilStepOneId(row.kanban_id)) continue;
    const redeId = String(row.rede_franqueado_id ?? '').trim();
    if (!redeId) continue;
    const nome = String(row.franqueado_nome ?? '').trim();
    if (nome) stepOneNomeRedePorCardId.set(row.id, nome);
    redeIdsToResolve.add(redeId);
  }

  const stepOneProfilePorRedeId =
    redeIdsToResolve.size > 0
      ? await buscarProfilesFranqueadoPorRedeIdsBatch(supabase, [...redeIdsToResolve])
      : new Map<string, string | null>();

  const briefs = cards.map(toKanbanCardBrief);
  const enriched = await enrichCardsComResponsavelFase(supabase, briefs, {
    stepOneNomeRedePorCardId,
    stepOneProfilePorRedeId,
  });
  const porId = new Map(enriched.map((c) => [c.id, c]));
  return cards.map((row) => {
    const extra = porId.get(row.id);
    if (!extra) return row;
    return {
      ...row,
      responsavel_fase_id: extra.responsavel_fase_id ?? null,
      responsavel_fase_nome: extra.responsavel_fase_nome ?? null,
    };
  });
}

function mapFranqueado(raw: RawCard): PipelineFranqueadoUnidade | null {
  const id = String(raw.id ?? '').trim();
  if (!id) return null;
  return {
    rede_franqueado_id: id,
    n_franquia: raw.n_franquia != null ? String(raw.n_franquia) : null,
    franqueado_nome: raw.nome_completo != null ? String(raw.nome_completo) : null,
    ordem: Number(raw.ordem ?? 0),
  };
}

async function fetchFasesKanbansPipeline(
  supabase: SupabaseClient,
  kanbanIds: string[],
): Promise<{ fases: PainelFaseDTO[]; maxOrdemPorKanban: Record<string, number> }> {
  const fases: PainelFaseDTO[] = [];
  const maxOrdemPorKanban: Record<string, number> = {};
  const uniq = [...new Set(kanbanIds.filter(Boolean))];
  if (uniq.length === 0) return { fases, maxOrdemPorKanban };

  const { data: rows, error } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias, sla_tipo, slug, fase_conversao, kanban_id')
    .in('kanban_id', uniq)
    .eq('ativo', true)
    .order('ordem');

  if (error) {
    console.error('[fetchFasesKanbansPipeline]', error.message);
    return { fases, maxOrdemPorKanban };
  }

  for (const raw of rows ?? []) {
    const row = raw as {
      id: string;
      nome?: string | null;
      ordem?: number | null;
      sla_dias?: number | string | null;
      sla_tipo?: string | null;
      slug?: string | null;
      fase_conversao?: boolean | null;
      kanban_id?: string | null;
    };
    const kid = String(row.kanban_id ?? '').trim();
    const ordem = Number(row.ordem ?? 0);
    fases.push({
      id: String(row.id),
      nome: String(row.nome ?? ''),
      ordem,
      sla_dias: row.sla_dias != null && row.sla_dias !== '' ? Number(row.sla_dias) : null,
      sla_tipo: normalizarSlaTipo(row.sla_tipo),
      fase_conversao: Boolean(row.fase_conversao),
      slug: row.slug != null ? String(row.slug) : null,
    });
    if (kid && ordem > 0) {
      maxOrdemPorKanban[kid] = Math.max(maxOrdemPorKanban[kid] ?? 0, ordem);
    }
  }

  return { fases, maxOrdemPorKanban };
}

async function fetchUnidadeEnrichment(
  supabase: SupabaseClient,
  cards: PipelineCardRow[],
): Promise<PipelineFranqueadoraEnrichment | null> {
  if (cards.length === 0) {
    return {
      fases: [],
      chamados: [],
      gargaloRanking: [],
      maxOrdemPorKanban: {},
    };
  }

  try {
    const cardIds = cards.map((c) => c.id);
    const kanbanIds = [...new Set(cards.map((c) => c.kanban_id))];

    const [fasesPack, chamados] = await Promise.all([
      fetchFasesKanbansPipeline(supabase, kanbanIds),
      fetchPainelChamados(supabase, cardIds, 'nativo').catch(() => []),
    ]);

    return {
      fases: fasesPack.fases,
      chamados,
      gargaloRanking: [],
      maxOrdemPorKanban: fasesPack.maxOrdemPorKanban,
    };
  } catch {
    return null;
  }
}

async function fetchFranqueadoraEnrichment(
  supabase: SupabaseClient,
  cards: PipelineCardRow[],
): Promise<PipelineFranqueadoraEnrichment | null> {
  if (cards.length === 0) {
    return {
      fases: [],
      chamados: [],
      gargaloRanking: [],
      maxOrdemPorKanban: {},
    };
  }

  try {
    const cardIds = cards.map((c) => c.id);
    const kanbanIds = [...new Set(cards.map((c) => c.kanban_id))];

    const [fasesPack, chamados] = await Promise.all([
      fetchFasesKanbansPipeline(supabase, kanbanIds),
      fetchPainelChamados(supabase, cardIds, 'nativo').catch(() => []),
    ]);

    const base: PipelineFranqueadoraEnrichment = {
      fases: fasesPack.fases,
      chamados,
      gargaloRanking: [],
      maxOrdemPorKanban: fasesPack.maxOrdemPorKanban,
    };

    const { enriquecerPipelineCard } = await import('@/lib/kanban/pipeline-cards-utils');
    const displayCards = cards.map(enriquecerPipelineCard);
    base.gargaloRanking = computeGargaloRankingRede(displayCards, base);

    return base;
  } catch {
    return null;
  }
}

export type FetchPipelineCardsOpts = {
  mode: PipelineCardsViewMode;
  /** UUID em `rede_franqueados.id` — obrigatório quando `mode === 'unidade'`. */
  franqueadoId?: string;
  /** Incluir cards arquivados/concluídos (padrão: só ativos em andamento). */
  incluirEncerrados?: boolean;
  /** Carregar dados para KPIs extendidos, Gantt e drawer (padrão: true). */
  comEnrichment?: boolean;
};

/**
 * Carrega cards nativos vinculados a unidades de franquia.
 * Fonte única: `kanban_cards` + `kanban_fases` + `kanbans` (mesmos joins do board).
 * Modos franqueadora/unidade apenas filtram escopo — o mapeamento de cada card é idêntico.
 */
export async function fetchPipelineCards(
  supabase: SupabaseClient,
  opts: FetchPipelineCardsOpts,
): Promise<PipelineCardsDataset> {
  const mode = opts.mode === 'rede' ? 'franqueadora' : opts.mode;
  const redeId = String(opts.franqueadoId ?? '').trim();
  if (mode === 'unidade' && !redeId) {
    return { cards: [], franqueados: [] };
  }

  const comEnrichment = opts.comEnrichment ?? true;

  let franqueadosQuery = supabase
    .from('rede_franqueados')
    .select('id, n_franquia, nome_completo, ordem')
    .order('ordem');

  if (mode === 'unidade') {
    franqueadosQuery = franqueadosQuery.eq('id', redeId);
  }

  const frResPromise = franqueadosQuery;

  let cardsQuery = supabase.from('kanban_cards').select(CARD_SELECT_WITH_FUNIL).eq('status', 'ativo');

  if (!opts.incluirEncerrados) {
    cardsQuery = cardsQuery.eq('arquivado', false).eq('concluido', false);
  }

  if (mode === 'unidade') {
    cardsQuery = cardsQuery.eq('rede_franqueado_id', redeId);
  } else {
    cardsQuery = cardsQuery.not('rede_franqueado_id', 'is', null);
  }

  cardsQuery = cardsQuery.order('updated_at', { ascending: false });

  const [frRes, cardResInitial] = await Promise.all([frResPromise, cardsQuery]);

  let cardData: RawCard[] | null = (cardResInitial.data as RawCard[] | null) ?? null;
  if (cardResInitial.error) {
    const errMsg = cardResInitial.error.message;
    if (/opcao_assinada|comite_aprovado|contrato_assinado|prefeitura_aprovada|obra_iniciada|obra_finalizada/i.test(errMsg)) {
      let fallbackQuery = supabase
        .from('kanban_cards')
        .select(/opcao_assinada|comite_aprovado/i.test(errMsg) ? CARD_SELECT_WITH_CONTRATO : CARD_SELECT_BASE)
        .eq('status', 'ativo');
      if (!opts.incluirEncerrados) {
        fallbackQuery = fallbackQuery.eq('arquivado', false).eq('concluido', false);
      }
      if (mode === 'unidade') {
        fallbackQuery = fallbackQuery.eq('rede_franqueado_id', redeId);
      } else {
        fallbackQuery = fallbackQuery.not('rede_franqueado_id', 'is', null);
      }
      fallbackQuery = fallbackQuery.order('updated_at', { ascending: false });
      const fallbackRes = await fallbackQuery;
      if (fallbackRes.error) throw new Error(fallbackRes.error.message);
      cardData = (fallbackRes.data as unknown as RawCard[] | null) ?? null;
    } else if (/projeto_negocio|projeto_id/i.test(errMsg)) {
      let fallbackQuery = supabase.from('kanban_cards').select(CARD_SELECT_SEM_PROJETO).eq('status', 'ativo');
      if (!opts.incluirEncerrados) {
        fallbackQuery = fallbackQuery.eq('arquivado', false).eq('concluido', false);
      }
      if (mode === 'unidade') {
        fallbackQuery = fallbackQuery.eq('rede_franqueado_id', redeId);
      } else {
        fallbackQuery = fallbackQuery.not('rede_franqueado_id', 'is', null);
      }
      fallbackQuery = fallbackQuery.order('updated_at', { ascending: false });
      const fallbackRes = await fallbackQuery;
      if (fallbackRes.error) throw new Error(fallbackRes.error.message);
      cardData = (fallbackRes.data as unknown as RawCard[] | null) ?? null;
    } else {
      throw new Error(cardResInitial.error.message);
    }
  }

  if (frRes.error) throw new Error(frRes.error.message);

  const franqueados = (frRes.data ?? [])
    .map((r) => mapFranqueado(r as RawCard))
    .filter((f): f is PipelineFranqueadoUnidade => f != null)
    .sort((a, b) =>
      compareRedePorNFranquia(
        { n_franquia: a.n_franquia, ordem: a.ordem, id: a.rede_franqueado_id },
        { n_franquia: b.n_franquia, ordem: b.ordem, id: b.rede_franqueado_id },
      ),
    );

  const cardsRaw = (cardData ?? [])
    .map((r) => mapPipelineCardRow(r as RawCard))
    .filter((c): c is PipelineCardRow => c != null);

  const cards = await enriquecerResponsavelPipelineCards(supabase, cardsRaw);

  let enrichment: PipelineFranqueadoraEnrichment | null = null;
  if (comEnrichment) {
    enrichment =
      mode === 'franqueadora'
        ? await fetchFranqueadoraEnrichment(supabase, cards)
        : await fetchUnidadeEnrichment(supabase, cards);
  }

  return { cards, franqueados, enrichment };
}
