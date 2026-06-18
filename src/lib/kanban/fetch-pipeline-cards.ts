import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanCardBrief } from '@/components/kanban-shared/types';
import { compareRedePorNFranquia } from '@/lib/rede-franqueados';
import { enrichCardsComResponsavelFase } from '@/lib/kanban/responsavel-fase-checklist';
import type {
  PipelineCardRow,
  PipelineCardsDataset,
  PipelineCardsViewMode,
  PipelineFranqueadoUnidade,
} from '@/lib/kanban/pipeline-cards-types';

const CARD_SELECT = `
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
  kanban_fases ( nome, slug, ordem, sla_dias ),
  rede_franqueados ( n_franquia, nome_completo, ordem )
`;

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
      | { nome?: string | null; slug?: string | null; ordem?: number | null; sla_dias?: number | null }
      | Array<{ nome?: string | null; slug?: string | null; ordem?: number | null; sla_dias?: number | null }>
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

export type FetchPipelineCardsOpts = {
  mode: PipelineCardsViewMode;
  /** UUID em `rede_franqueados.id` — obrigatório quando `mode === 'unidade'`. */
  franqueadoId?: string;
  /** Incluir cards arquivados/concluídos (padrão: só ativos em andamento). */
  incluirEncerrados?: boolean;
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

  let franqueadosQuery = supabase
    .from('rede_franqueados')
    .select('id, n_franquia, nome_completo, ordem')
    .order('ordem');

  if (opts.mode === 'unidade') {
    franqueadosQuery = franqueadosQuery.eq('id', redeId);
  }

  let cardsQuery = supabase.from('kanban_cards').select(CARD_SELECT).eq('status', 'ativo');

  if (!opts.incluirEncerrados) {
    cardsQuery = cardsQuery.eq('arquivado', false).eq('concluido', false);
  }

  if (opts.mode === 'unidade') {
    cardsQuery = cardsQuery.eq('rede_franqueado_id', redeId);
  } else {
    cardsQuery = cardsQuery.not('rede_franqueado_id', 'is', null);
  }

  cardsQuery = cardsQuery.order('updated_at', { ascending: false });

  const [frRes, cardRes] = await Promise.all([franqueadosQuery, cardsQuery]);

  if (frRes.error) throw new Error(frRes.error.message);
  if (cardRes.error) throw new Error(cardRes.error.message);

  const franqueados = (frRes.data ?? [])
    .map((r) => mapFranqueado(r as RawCard))
    .filter((f): f is PipelineFranqueadoUnidade => f != null)
    .sort((a, b) =>
      compareRedePorNFranquia(
        { n_franquia: a.n_franquia, ordem: a.ordem, id: a.rede_franqueado_id },
        { n_franquia: b.n_franquia, ordem: b.ordem, id: b.rede_franqueado_id },
      ),
    );

  const cardsRaw = (cardRes.data ?? [])
    .map((r) => mapPipelineCardRow(r as RawCard))
    .filter((c): c is PipelineCardRow => c != null);

  const cards = await enriquecerResponsavelPipelineCards(supabase, cardsRaw);

  return { cards, franqueados };
}
