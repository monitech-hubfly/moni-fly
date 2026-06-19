import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanCardBrief } from '@/components/kanban-shared/types';
import { compareRedePorNFranquia } from '@/lib/rede-franqueados';
import { enrichCardsComResponsavelFase } from '@/lib/kanban/responsavel-fase-checklist';
import { fetchKanbanFasesAtivas } from '@/lib/kanban/fetch-kanban-fases';
import { fetchPainelChamados } from '@/lib/kanban/fetch-painel-chamados';
import { computeGargaloRankingRede } from '@/lib/kanban/pipeline-franqueadora-compute';
import type {
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
} from '@/lib/kanban/painel-performance-types';
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
  kanban_fases ( nome, slug, ordem, sla_dias, fase_conversao ),
  rede_franqueados ( n_franquia, nome_completo, ordem )
`;

const CARD_SELECT_WITH_CONTRATO = `${CARD_SELECT_BASE.trim()},
  contrato_assinado,
  contrato_assinado_em
`;

type RawCard = Record<string, unknown>;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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
      | { nome?: string | null; slug?: string | null; ordem?: number | null; sla_dias?: number | null; fase_conversao?: boolean | null }
      | Array<{ nome?: string | null; slug?: string | null; ordem?: number | null; sla_dias?: number | null; fase_conversao?: boolean | null }>
      | null,
  );
  const rede = relOne(
    raw.rede_franqueados as
      | { n_franquia?: string | null; nome_completo?: string | null; ordem?: number | null }
      | Array<{ n_franquia?: string | null; nome_completo?: string | null; ordem?: number | null }>
      | null,
  );

  return {
    id,
    titulo: String(raw.titulo ?? '').trim() || '(sem título)',
    kanban_id: String(raw.kanban_id ?? ''),
    kanban_nome: String(kanban?.nome ?? '').trim() || 'Kanban',
    fase_id: String(raw.fase_id ?? ''),
    fase_nome: String(fase?.nome ?? '').trim() || '—',
    fase_slug: fase?.slug != null ? String(fase.slug) : null,
    fase_ordem: Number(fase?.ordem ?? 0),
    fase_sla_dias: fase?.sla_dias != null ? Number(fase.sla_dias) : null,
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
    contrato_assinado: raw.contrato_assinado === true,
    contrato_assinado_em:
      raw.contrato_assinado_em != null ? String(raw.contrato_assinado_em) : null,
  };
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
  const briefs = cards.map(toKanbanCardBrief);
  const enriched = await enrichCardsComResponsavelFase(supabase, briefs);
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

async function fetchHistoricoMovimentosPipeline(
  supabase: SupabaseClient,
  cardIds: string[],
): Promise<PainelHistoricoMovimentoDTO[]> {
  const out: PainelHistoricoMovimentoDTO[] = [];
  for (const part of chunk(cardIds, 80)) {
    if (part.length === 0) continue;
    const { data: rows, error } = await supabase
      .from('kanban_historico')
      .select('card_id,acao,detalhe,criado_em')
      .in('card_id', part)
      .in('acao', ['card_criado', 'fase_avancada', 'fase_retrocedida', 'card_arquivado']);
    if (error) continue;
    for (const r of rows ?? []) {
      const row = r as {
        card_id: string;
        acao: string;
        detalhe: Record<string, unknown> | null;
        criado_em: string;
      };
      out.push({
        card_id: row.card_id,
        acao: row.acao,
        detalhe: row.detalhe ?? null,
        criado_em: String(row.criado_em ?? new Date().toISOString()),
      });
    }
  }
  return out;
}

async function fetchFasesKanbansPipeline(
  supabase: SupabaseClient,
  kanbanIds: string[],
): Promise<{ fases: PainelFaseDTO[]; maxOrdemPorKanban: Record<string, number> }> {
  const fases: PainelFaseDTO[] = [];
  const maxOrdemPorKanban: Record<string, number> = {};
  const uniq = [...new Set(kanbanIds.filter(Boolean))];

  await Promise.all(
    uniq.map(async (kid) => {
      const rows = await fetchKanbanFasesAtivas(supabase, kid);
      let maxOrd = 0;
      for (const f of rows) {
        maxOrd = Math.max(maxOrd, f.ordem);
        fases.push({
          id: f.id,
          nome: f.nome,
          ordem: f.ordem,
          sla_dias: f.sla_dias,
          fase_conversao: Boolean(f.fase_conversao),
          slug: f.slug ?? null,
        });
      }
      if (maxOrd > 0) maxOrdemPorKanban[kid] = maxOrd;
    }),
  );

  return { fases, maxOrdemPorKanban };
}

async function fetchUnidadeEnrichment(
  supabase: SupabaseClient,
  cards: PipelineCardRow[],
): Promise<PipelineFranqueadoraEnrichment | null> {
  if (cards.length === 0) {
    return {
      fases: [],
      historicoMovimentos: [],
      chamados: [],
      gargaloRanking: [],
      maxOrdemPorKanban: {},
    };
  }

  try {
    const cardIds = cards.map((c) => c.id);
    const kanbanIds = [...new Set(cards.map((c) => c.kanban_id))];

    const [fasesPack, historicoMovimentos, chamados] = await Promise.all([
      fetchFasesKanbansPipeline(supabase, kanbanIds),
      fetchHistoricoMovimentosPipeline(supabase, cardIds),
      fetchPainelChamados(supabase, cardIds, 'nativo').catch(() => []),
    ]);

    return {
      fases: fasesPack.fases,
      historicoMovimentos,
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
      historicoMovimentos: [],
      chamados: [],
      gargaloRanking: [],
      maxOrdemPorKanban: {},
    };
  }

  try {
    const cardIds = cards.map((c) => c.id);
    const kanbanIds = [...new Set(cards.map((c) => c.kanban_id))];

    const [fasesPack, historicoMovimentos, chamados] = await Promise.all([
      fetchFasesKanbansPipeline(supabase, kanbanIds),
      fetchHistoricoMovimentosPipeline(supabase, cardIds),
      fetchPainelChamados(supabase, cardIds, 'nativo').catch(() => []),
    ]);

    const base: PipelineFranqueadoraEnrichment = {
      fases: fasesPack.fases,
      historicoMovimentos,
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
  const redeId = String(opts.franqueadoId ?? '').trim();
  if (opts.mode === 'unidade' && !redeId) {
    return { cards: [], franqueados: [] };
  }

  const comEnrichment = opts.comEnrichment ?? true;

  let franqueadosQuery = supabase
    .from('rede_franqueados')
    .select('id, n_franquia, nome_completo, ordem')
    .order('ordem');

  if (opts.mode === 'unidade') {
    franqueadosQuery = franqueadosQuery.eq('id', redeId);
  }

  const frResPromise = franqueadosQuery;

  let cardsQuery = supabase.from('kanban_cards').select(CARD_SELECT_WITH_CONTRATO).eq('status', 'ativo');

  if (!opts.incluirEncerrados) {
    cardsQuery = cardsQuery.eq('arquivado', false).eq('concluido', false);
  }

  if (opts.mode === 'unidade') {
    cardsQuery = cardsQuery.eq('rede_franqueado_id', redeId);
  } else {
    cardsQuery = cardsQuery.not('rede_franqueado_id', 'is', null);
  }

  cardsQuery = cardsQuery.order('updated_at', { ascending: false });

  const [frRes, cardResInitial] = await Promise.all([frResPromise, cardsQuery]);

  let cardData: RawCard[] | null = (cardResInitial.data as RawCard[] | null) ?? null;
  if (cardResInitial.error) {
    if (/contrato_assinado/i.test(cardResInitial.error.message)) {
      let fallbackQuery = supabase.from('kanban_cards').select(CARD_SELECT_BASE).eq('status', 'ativo');
      if (!opts.incluirEncerrados) {
        fallbackQuery = fallbackQuery.eq('arquivado', false).eq('concluido', false);
      }
      if (opts.mode === 'unidade') {
        fallbackQuery = fallbackQuery.eq('rede_franqueado_id', redeId);
      } else {
        fallbackQuery = fallbackQuery.not('rede_franqueado_id', 'is', null);
      }
      fallbackQuery = fallbackQuery.order('updated_at', { ascending: false });
      const fallbackRes = await fallbackQuery;
      if (fallbackRes.error) throw new Error(fallbackRes.error.message);
      cardData = (fallbackRes.data as RawCard[] | null) ?? null;
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
      opts.mode === 'franqueadora'
        ? await fetchFranqueadoraEnrichment(supabase, cards)
        : await fetchUnidadeEnrichment(supabase, cards);
  }

  return { cards, franqueados, enrichment };
}
